import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { checkProhibitedContent } from '../config/business';
import { createSvgPlaceholder } from '../utils/placeholderImage';

export const itemsRouter = Router();

/**
 * Photos are stored as data URIs in the database. Sending them inline in list responses
 * makes pages very heavy, so list/detail responses expose a small cacheable URL instead.
 */
function toPhotoUrl<T extends { id: string; url: string }>(photo: T): T {
  if (photo.url && photo.url.startsWith('data:')) {
    return { ...photo, url: `/api/items/photo/${photo.id}` };
  }
  return photo;
}

function withLightPhotos<T extends { photos?: Array<{ id: string; url: string }> }>(item: T): T {
  if (!item.photos) return item;
  return { ...item, photos: item.photos.map(toPhotoUrl) };
}

/**
 * GET /api/items/photo/:photoId
 * Serves a stored photo as a real image with long-lived caching.
 */
itemsRouter.get('/photo/:photoId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photo = await prisma.itemPhoto.findUnique({
      where: { id: req.params.photoId },
      select: { url: true },
    });
    if (!photo) {
      res.status(404).end();
      return;
    }

    const match = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/s.exec(photo.url);
    if (!match) {
      res.redirect(302, photo.url);
      return;
    }

    const mime = match[1];
    const isBase64 = match[2].includes('base64');
    const payload = match[3];
    const body = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf-8');

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(body);
  } catch (err) {
    next(err);
  }
});

const listItemsQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  condition: z.string().optional(),
  deliveryMethod: z.enum(['ALL', 'PICKUP', 'DELIVERY']).optional(),
  sort: z.enum(['latest', 'price_asc', 'price_desc']).optional().default('latest'),
  limit: z.coerce.number().min(1).max(100).optional().default(24),
  page: z.coerce.number().min(1).optional().default(1),
});

const createItemSchema = z.object({
  title: z.string().min(5, 'Judul minimal 5 karakter').max(100, 'Judul maksimal 100 karakter').trim(),
  description: z.string().min(10, 'Deskripsi minimal 10 karakter').max(2000, 'Deskripsi maksimal 2000 karakter').trim(),
  categoryId: z.string().uuid('Kategori tidak valid'),
  priceRupiah: z.coerce.number().int().min(1000, 'Harga minimal Rp 1.000'),
  condition: z.enum(['BARU', 'SEPERTI_BARU', 'BEKAS_BAIK', 'BEKAS_CUKUP'], {
    errorMap: () => ({ message: 'Pilih kondisi barang yang valid' }),
  }),
  size: z.string().optional().nullable(),
  brand: z.string().max(50).optional().nullable(),
  allowedDeliveryMethod: z.enum(['PICKUP_ONLY', 'PICKUP_OR_DELIVERY']).default('PICKUP_OR_DELIVERY'),
  pickupLocation: z.string().max(200).optional().nullable(),
  isNegotiable: z.boolean().optional().default(false),
  photos: z.array(z.string().min(1)).max(6, 'Maksimal 6 foto').optional().default([]),
});

const updateItemSchema = createItemSchema.partial();

/**
 * GET /api/items
 * List public active items with filtering, search, and pagination.
 */
itemsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listItemsQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
    };

    if (query.category && query.category !== 'semua') {
      where.category = {
        slug: query.category,
      };
    }

    if (query.search && query.search.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    if (query.condition) {
      where.condition = query.condition;
    }

    if (query.deliveryMethod === 'DELIVERY') {
      where.allowedDeliveryMethod = 'PICKUP_OR_DELIVERY';
    }

    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
    if (query.sort === 'price_asc') {
      orderBy = { priceRupiah: 'asc' };
    } else if (query.sort === 'price_desc') {
      orderBy = { priceRupiah: 'desc' };
    }

    const [total, items] = await Promise.all([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        orderBy,
        skip,
        take: query.limit,
        include: {
          category: {
            select: { id: true, name: true, slug: true, allowedDelivery: true },
          },
          seller: {
            select: { id: true, name: true, username: true, isVerified: true, campus: { select: { name: true, code: true } } },
          },
          photos: {
            orderBy: { displayOrder: 'asc' },
            take: 2,
            select: { id: true, url: true, isPrimary: true },
          },
        },
      }),
    ]);

    res.json({
      data: items.map(withLightPhotos),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/items/my/listings
 * Get listings belonging to the authenticated seller.
 */
itemsRouter.get('/my/listings', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const items = await prisma.item.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: { id: true, name: true, slug: true, allowedDelivery: true },
        },
        photos: {
          orderBy: { displayOrder: 'asc' },
          select: { id: true, url: true, isPrimary: true },
        },
        orders: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, status: true, buyerTotalRupiah: true },
        },
      },
    });

    const counts = {
      all: items.length,
      active: items.filter((i) => i.status === 'ACTIVE').length,
      reserved: items.filter((i) => i.status === 'RESERVED').length,
      sold: items.filter((i) => i.status === 'SOLD').length,
      archived: items.filter((i) => i.status === 'ARCHIVED').length,
    };

    res.json({
      data: items.map(withLightPhotos),
      meta: { counts },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/items/:id
 * Get single item details.
 */
itemsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        seller: {
          select: {
            id: true,
            name: true,
            username: true,
            isVerified: true,
            verifiedAt: true,
            createdAt: true,
            campus: { select: { id: true, name: true, code: true } },
            reviewsReceived: {
              select: { rating: true, comment: true, createdAt: true },
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        photos: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!item) {
      res.status(404).json({ error: 'Not Found', message: 'Barang tidak ditemukan.' });
      return;
    }

    // Calculate seller review average
    const sellerRatings = item.seller.reviewsReceived.map((r) => r.rating);
    const avgRating = sellerRatings.length
      ? Number((sellerRatings.reduce((a, b) => a + b, 0) / sellerRatings.length).toFixed(1))
      : null;

    res.json({
      data: {
        ...withLightPhotos(item),
        seller: {
          ...item.seller,
          averageRating: avgRating,
          reviewCount: sellerRatings.length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/items
 * Create a new item listing by an authenticated student.
 */
itemsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    // 1. Validate request body
    const body = createItemSchema.parse(req.body);

    // 2. Prohibited keywords check
    const contentCheck = checkProhibitedContent(`${body.title} ${body.description}`);
    if (contentCheck.prohibited) {
      res.status(400).json({
        error: 'Prohibited Item',
        message: `Barang mengandung kata yang dilarang diperjualbelikan di Ocho: "${contentCheck.matchedKeyword}". Barang seperti vape/rokok, alkohol, obat-obatan, dan suplemen dilarang.`,
      });
      return;
    }

    // 3. Category existence & business rules check
    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
    });

    if (!category) {
      res.status(404).json({ error: 'Not Found', message: 'Kategori barang tidak ditemukan.' });
      return;
    }

    if (category.isForbidden) {
      res.status(400).json({
        error: 'Forbidden Category',
        message: 'Kategori ini tidak diizinkan untuk diperjualbelikan pada tahap ini (misal: gadget/laptop/HP).',
      });
      return;
    }

    // Rule: Fashion requires size
    if (category.requiresSize && (!body.size || !body.size.trim())) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Kategori ${category.name} wajib menyertakan ukuran (contoh: S, M, L, XL, atau nomor sepatu).`,
      });
      return;
    }

    // Rule: Perabot Kos & Paket Pindahan are strictly PICKUP_ONLY
    let allowedDelivery = body.allowedDeliveryMethod;
    if (category.allowedDelivery === 'PICKUP_ONLY') {
      allowedDelivery = 'PICKUP_ONLY';
    }

    // 4. Photos handling (use uploaded or fallback placeholder SVG)
    let photoUrls = body.photos.filter((p) => p && typeof p === 'string');
    if (photoUrls.length === 0) {
      const generatedPlaceholder = createSvgPlaceholder({
        title: body.title,
        category: category.name,
      });
      photoUrls = [generatedPlaceholder];
    }

    // 5. Create item in database
    const newItem = await prisma.item.create({
      data: {
        sellerId: user.id,
        categoryId: category.id,
        title: body.title,
        description: body.description,
        priceRupiah: body.priceRupiah,
        condition: body.condition,
        size: body.size ? body.size.trim() : null,
        brand: body.brand ? body.brand.trim() : null,
        allowedDeliveryMethod: allowedDelivery,
        pickupLocation: body.pickupLocation ? body.pickupLocation.trim() : null,
        isNegotiable: body.isNegotiable || false,
        status: 'ACTIVE',
        photos: {
          create: photoUrls.map((url, idx) => ({
            url,
            isPrimary: idx === 0,
            displayOrder: idx,
          })),
        },
      },
      include: {
        category: true,
        photos: true,
      },
    });

    res.status(201).json({
      message: 'Barang berhasil diunggah dan aktif di marketplace Ocho.',
      data: newItem,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: err.errors[0]?.message || 'Input data barang tidak valid.',
        details: err.errors,
      });
      return;
    }
    next(err);
  }
});

/**
 * PATCH /api/items/:id
 * Edit an existing listing (only by the owner).
 */
itemsRouter.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const itemId = req.params.id;

    const existing = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Barang tidak ditemukan.' });
      return;
    }

    if (existing.sellerId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden', message: 'Anda tidak memiliki akses untuk mengubah barang ini.' });
      return;
    }

    const body = updateItemSchema.parse(req.body);

    if (body.title || body.description) {
      const checkText = `${body.title || existing.title} ${body.description || existing.description}`;
      const contentCheck = checkProhibitedContent(checkText);
      if (contentCheck.prohibited) {
        res.status(400).json({
          error: 'Prohibited Item',
          message: `Barang mengandung kata yang dilarang: "${contentCheck.matchedKeyword}".`,
        });
        return;
      }
    }

    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.description && { description: body.description }),
        ...(body.priceRupiah && { priceRupiah: body.priceRupiah }),
        ...(body.condition && { condition: body.condition }),
        ...(body.size !== undefined && { size: body.size }),
        ...(body.brand !== undefined && { brand: body.brand }),
        ...(body.allowedDeliveryMethod && { allowedDeliveryMethod: body.allowedDeliveryMethod }),
        ...(body.pickupLocation !== undefined && { pickupLocation: body.pickupLocation }),
        ...(body.isNegotiable !== undefined && { isNegotiable: body.isNegotiable }),
      },
      include: {
        category: true,
        photos: true,
      },
    });

    res.json({
      message: 'Barang berhasil diperbarui.',
      data: updated,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation Error',
        message: err.errors[0]?.message || 'Input data pembaruan tidak valid.',
        details: err.errors,
      });
      return;
    }
    next(err);
  }
});

/**
 * DELETE /api/items/:id
 * Archive or delete an item (only by owner or admin).
 */
itemsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const itemId = req.params.id;

    const existing = await prisma.item.findUnique({
      where: { id: itemId },
      include: { orders: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Not Found', message: 'Barang tidak ditemukan.' });
      return;
    }

    if (existing.sellerId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden', message: 'Anda tidak memiliki hak untuk menghapus barang ini.' });
      return;
    }

    // If item has orders, archive it rather than hard delete to preserve financial history
    if (existing.orders.length > 0) {
      const archived = await prisma.item.update({
        where: { id: itemId },
        data: { status: 'ARCHIVED' },
      });
      res.json({ message: 'Barang diarsipkan karena memiliki riwayat transaksi.', data: archived });
      return;
    }

    await prisma.item.delete({
      where: { id: itemId },
    });

    res.json({ message: 'Barang berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
});
