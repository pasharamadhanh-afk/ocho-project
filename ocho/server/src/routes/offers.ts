import { Router, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const offersRouter = Router();

const createOfferSchema = z.object({
  itemId: z.string().uuid('ID barang tidak valid'),
  offerPriceRupiah: z.coerce.number().int().min(1000, 'Tawaran minimal Rp 1.000'),
  message: z.string().max(200, 'Pesan maksimal 200 karakter').optional().nullable(),
});

const respondOfferSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT'], {
    errorMap: () => ({ message: 'Pilih aksi: ACCEPT atau REJECT' }),
  }),
  sellerNote: z.string().max(200).optional().nullable(),
});

/**
 * POST /api/offers
 * Submit a price offer (nego) for an item.
 */
offersRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const body = createOfferSchema.parse(req.body);

    const item = await prisma.item.findUnique({
      where: { id: body.itemId },
      select: {
        id: true,
        sellerId: true,
        title: true,
        priceRupiah: true,
        status: true,
        isNegotiable: true,
      },
    });

    if (!item) {
      res.status(404).json({ error: 'Not Found', message: 'Barang tidak ditemukan.' });
      return;
    }

    if (item.status !== 'ACTIVE') {
      res.status(400).json({
        error: 'Item Unavailable',
        message: 'Barang sedang dipesan atau sudah terjual sehingga tidak dapat dinego.',
      });
      return;
    }

    if (!item.isNegotiable) {
      res.status(400).json({
        error: 'Not Negotiable',
        message: 'Penjual tidak mengaktifkan fitur nego untuk barang ini (harga pas).',
      });
      return;
    }

    if (item.sellerId === user.id) {
      res.status(400).json({
        error: 'Invalid Action',
        message: 'Anda tidak dapat menawar barang milik sendiri.',
      });
      return;
    }

    if (body.offerPriceRupiah >= item.priceRupiah) {
      res.status(400).json({
        error: 'Invalid Offer Price',
        message: 'Harga tawaran nego harus lebih rendah dari harga awal barang.',
      });
      return;
    }

    // Minimum 30% of original price to prevent unreasonable lowballing
    const minOfferAllowed = Math.floor(item.priceRupiah * 0.3);
    if (body.offerPriceRupiah < minOfferAllowed) {
      res.status(400).json({
        error: 'Offer Too Low',
        message: `Tawaran terlalu rendah. Minimal penawaran yang wajar adalah Rp ${minOfferAllowed.toLocaleString('id-ID')}.`,
      });
      return;
    }

    // Check if buyer already has an active pending offer for this item
    const existingOffer = await prisma.offer.findFirst({
      where: {
        itemId: item.id,
        buyerId: user.id,
        status: 'PENDING',
      },
    });

    let offer;
    if (existingOffer) {
      // Update existing offer with new price and message
      offer = await prisma.offer.update({
        where: { id: existingOffer.id },
        data: {
          offerPriceRupiah: body.offerPriceRupiah,
          message: body.message ? body.message.trim() : null,
          status: 'PENDING',
          sellerNote: null,
        },
      });
    } else {
      offer = await prisma.offer.create({
        data: {
          itemId: item.id,
          buyerId: user.id,
          sellerId: item.sellerId,
          offerPriceRupiah: body.offerPriceRupiah,
          message: body.message ? body.message.trim() : null,
          status: 'PENDING',
        },
      });
    }

    res.status(201).json({
      message: 'Tawaran nego berhasil dikirim ke penjual.',
      data: offer,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/offers/my
 * List offers for current user (both sent as buyer and received as seller).
 */
offersRouter.get('/my', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const [asBuyer, asSeller] = await Promise.all([
      prisma.offer.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          item: {
            select: {
              id: true,
              title: true,
              priceRupiah: true,
              status: true,
              photos: {
                take: 1,
                orderBy: { displayOrder: 'asc' },
                select: { id: true, url: true },
              },
            },
          },
          seller: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      }),
      prisma.offer.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          item: {
            select: {
              id: true,
              title: true,
              priceRupiah: true,
              status: true,
              photos: {
                take: 1,
                orderBy: { displayOrder: 'asc' },
                select: { id: true, url: true },
              },
            },
          },
          buyer: {
            select: {
              id: true,
              name: true,
              username: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    res.json({
      data: {
        asBuyer,
        asSeller,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/offers/:id/respond
 * Seller accepts or rejects an offer.
 */
offersRouter.patch('/:id/respond', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const body = respondOfferSchema.parse(req.body);

    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { item: true },
    });

    if (!offer) {
      res.status(404).json({ error: 'Not Found', message: 'Tawaran tidak ditemukan.' });
      return;
    }

    if (offer.sellerId !== user.id) {
      res.status(403).json({ error: 'Forbidden', message: 'Hanya penjual barang yang dapat merespons tawaran ini.' });
      return;
    }

    if (offer.status !== 'PENDING') {
      res.status(400).json({
        error: 'Invalid State',
        message: `Tawaran ini sudah dalam status "${offer.status}" dan tidak dapat diubah lagi.`,
      });
      return;
    }

    const newStatus = body.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';

    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: newStatus,
        sellerNote: body.sellerNote ? body.sellerNote.trim() : null,
      },
    });

    res.json({
      message: newStatus === 'ACCEPTED' ? 'Tawaran harga berhasil diterima!' : 'Tawaran harga ditolak.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/offers/:id
 * Buyer cancels their pending offer.
 */
offersRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;

    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
    });

    if (!offer) {
      res.status(404).json({ error: 'Not Found', message: 'Tawaran tidak ditemukan.' });
      return;
    }

    if (offer.buyerId !== user.id) {
      res.status(403).json({ error: 'Forbidden', message: 'Anda hanya dapat membatalkan tawaran Anda sendiri.' });
      return;
    }

    if (offer.status !== 'PENDING') {
      res.status(400).json({
        error: 'Invalid State',
        message: 'Hanya tawaran yang berstatus menunggu yang dapat dibatalkan.',
      });
      return;
    }

    await prisma.offer.update({
      where: { id: offer.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Tawaran nego berhasil dibatalkan.' });
  } catch (err) {
    next(err);
  }
});
