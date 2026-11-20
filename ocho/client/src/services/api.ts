/**
 * Ocho API Client Service
 * Typed fetch wrappers communicating with the Express backend.
 */

import { getStoredToken } from './auth';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  allowedDelivery: 'PICKUP_ONLY' | 'PICKUP_OR_DELIVERY';
  requiresSize: boolean;
  requiresCondition: boolean;
  isForbidden: boolean;
  displayOrder: number;
  activeItemCount?: number;
}

export interface ItemPhoto {
  id: string;
  url: string;
  isPrimary: boolean;
  displayOrder?: number;
}

export interface ItemSummary {
  id: string;
  title: string;
  description: string;
  priceRupiah: number;
  condition: string;
  size: string | null;
  brand: string | null;
  allowedDeliveryMethod: 'PICKUP_ONLY' | 'PICKUP_OR_DELIVERY';
  pickupLocation: string | null;
  isNegotiable?: boolean;
  status: 'ACTIVE' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
  createdAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    allowedDelivery: 'PICKUP_ONLY' | 'PICKUP_OR_DELIVERY';
  };
  seller: {
    id: string;
    name: string;
    username?: string | null;
    isVerified: boolean;
    campus?: {
      name: string;
      code: string;
    } | null;
  };
  photos: ItemPhoto[];
}

export interface BusinessConfig {
  platformCommissionRate: number;
  standardDeliveryFeeRupiah: number;
  minOrderForDeliveryRupiah: number;
  firstOrderFreeDelivery: boolean;
  allowedEmailDomains: string[];
  pickupOnlyCategories: string[];
}

export interface ReviewItem {
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ItemDetail extends ItemSummary {
  seller: {
    id: string;
    name: string;
    username?: string | null;
    isVerified: boolean;
    verifiedAt: string | null;
    createdAt: string;
    campus?: {
      id: string;
      name: string;
      code: string;
    } | null;
    averageRating: number | null;
    reviewCount: number;
    reviewsReceived?: ReviewItem[];
  };
}

export interface ItemListResponse {
  data: ItemSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrderMessageItem {
  id: string;
  orderId: string;
  senderId: string;
  message: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    username?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    role?: string;
  };
}

export interface OrderItem {
  id: string;
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  itemId: string;
  itemPriceRupiah: number;
  commissionRupiah: number;
  sellerPayoutRupiah: number;
  deliveryFeeRupiah: number;
  buyerTotalRupiah: number;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryAddress: string | null;
  deliveryDate?: string | null;
  buyerPhone: string;
  paymentMethod: 'QRIS' | 'COD';
  status: 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'READY_FOR_PICKUP' | 'ON_DELIVERY' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  reservedUntil: string | null;
  notes: string | null;
  paymentProofUrl?: string | null;
  messages?: OrderMessageItem[];
  createdAt: string;
  item: {
    id: string;
    title: string;
    priceRupiah: number;
    photos: ItemPhoto[];
    category?: { name: string };
  };
  buyer: { id: string; name: string; username?: string | null; phone?: string; email?: string };
  seller: { id: string; name: string; username?: string | null; phone?: string; email?: string; isVerified?: boolean };
  payment?: {
    id: string;
    paymentType: string;
    status: string;
    qrString: string | null;
    amountRupiah: number;
    transactionId: string | null;
  } | null;
  review?: {
    rating: number;
    comment: string | null;
    createdAt: string;
  } | null;
}

export interface BalanceData {
  currentBalanceRupiah: number;
  pendingWithdrawalRupiah: number;
  availableToWithdrawRupiah: number;
  history: Array<{
    id: string;
    type: string;
    amountRupiah: number;
    balanceAfterRupiah: number;
    description: string;
    createdAt: string;
  }>;
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsersCount?: number;
  unverifiedUsersCount?: number;
  verificationRatePercent?: number;
  activeItems: number;
  totalOrders: number;
  completedOrdersCount: number;
  completionRatePercent?: number;
  totalGmvRupiah: number;
  totalCommissionEarnedRupiah: number;
  averageOrderValueRupiah?: number;
  pendingReportsCount: number;
  pendingPayoutsCount: number;
  pendingPayoutAmountRupiah?: number;
  pickupOrdersCount?: number;
  deliveryOrdersCount?: number;
  qrisOrdersCount?: number;
  codOrdersCount?: number;
  topCategories?: Array<{ name: string; itemCount: number }>;
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error(`Gagal memuat kategori (${res.status})`);
  const json = await res.json();
  return json.data;
}

export async function fetchBusinessConfig(): Promise<BusinessConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error(`Gagal memuat konfigurasi (${res.status})`);
  return res.json();
}

export async function fetchItems(params: {
  category?: string;
  search?: string;
  condition?: string;
  deliveryMethod?: 'ALL' | 'PICKUP' | 'DELIVERY';
  sort?: 'latest' | 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
} = {}): Promise<ItemListResponse> {
  const searchParams = new URLSearchParams();
  if (params.category && params.category !== 'semua') searchParams.set('category', params.category);
  if (params.search && params.search.trim()) searchParams.set('search', params.search.trim());
  if (params.condition && params.condition !== 'ALL') searchParams.set('condition', params.condition);
  if (params.deliveryMethod && params.deliveryMethod !== 'ALL') searchParams.set('deliveryMethod', params.deliveryMethod);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const queryStr = searchParams.toString();
  const res = await fetch(`${API_BASE}/items${queryStr ? `?${queryStr}` : ''}`);
  if (!res.ok) throw new Error(`Gagal memuat barang (${res.status})`);
  return res.json();
}

export async function fetchItemById(id: string): Promise<ItemDetail> {
  const res = await fetch(`${API_BASE}/items/${encodeURIComponent(id)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Barang tidak ditemukan atau sudah dihapus.');
    throw new Error(`Gagal memuat detail barang (${res.status})`);
  }
  const json = await res.json();
  return json.data;
}

export async function createItem(payload: {
  title: string;
  description: string;
  categoryId: string;
  priceRupiah: number;
  condition: string;
  size?: string | null;
  brand?: string | null;
  allowedDeliveryMethod: 'PICKUP_ONLY' | 'PICKUP_OR_DELIVERY';
  pickupLocation?: string | null;
  isNegotiable?: boolean;
  photos: string[];
}): Promise<ItemDetail> {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Gagal mengunggah barang');
  return json.data;
}

export async function fetchMyListings(): Promise<ItemSummary[]> {
  const res = await fetch(`${API_BASE}/items/my/listings`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat daftar barang Anda');
  const json = await res.json();
  return json.data;
}

export async function deleteItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal menghapus barang');
  }
}

export async function createOrder(payload: {
  itemId: string;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  paymentMethod: 'QRIS' | 'COD';
  deliveryAddress?: string | null;
  deliveryDate?: string | null;
  buyerPhone: string;
  notes?: string | null;
  offerId?: string | null;
}): Promise<OrderItem> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Gagal membuat pesanan');
  return json.data;
}

export async function fetchOrders(role?: 'buyer' | 'seller'): Promise<OrderItem[]> {
  const query = role ? `?role=${role}` : '';
  const res = await fetch(`${API_BASE}/orders${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat daftar pesanan');
  const json = await res.json();
  return json.data;
}

export async function fetchOrderById(id: string): Promise<OrderItem> {
  const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat detail pesanan');
  const json = await res.json();
  return json.data;
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal mengubah status pesanan');
  }
}

export async function confirmOrderReceived(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}/receive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal mengonfirmasi penerimaan barang');
  }
}

export async function simulateOrderPayment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}/pay-simulate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal memproses simulasi pembayaran');
  }
}

export async function confirmOrderPayment(id: string, paymentProofUrl?: string): Promise<OrderItem> {
  const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}/confirm-payment`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ paymentProofUrl }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Gagal mengonfirmasi pembayaran');
  return json.data;
}

export async function fetchOrderMessages(orderId: string): Promise<OrderMessageItem[]> {
  const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/messages`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat pesan janjian');
  const json = await res.json();
  return json.data;
}

export async function sendOrderMessage(orderId: string, message: string): Promise<OrderMessageItem> {
  const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Gagal mengirim pesan');
  return json.data;
}

export async function submitReview(payload: {
  orderId: string;
  rating: number;
  comment?: string | null;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal mengirim ulasan');
  }
}

export async function fetchSellerBalance(): Promise<BalanceData> {
  const res = await fetch(`${API_BASE}/payouts/balance`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat data saldo');
  const json = await res.json();
  return json.data;
}

export async function requestPayout(payload: {
  amountRupiah: number;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/payouts`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal mengajukan penarikan saldo');
  }
}

export async function submitReport(payload: {
  itemId: string;
  reason: string;
  description: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal mengirim laporan');
  }
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat data statistik admin');
  const json = await res.json();
  return json.data;
}

export async function fetchAdminOrders(): Promise<OrderItem[]> {
  const res = await fetch(`${API_BASE}/admin/orders`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat pesanan admin');
  const json = await res.json();
  return json.data;
}

export async function fetchAdminUsers(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat pengguna');
  const json = await res.json();
  return json.data;
}

export async function verifyAdminUser(userId: string, isVerified: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/verify`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ isVerified }),
  });
  if (!res.ok) throw new Error('Gagal memperbarui verifikasi pengguna');
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal menghapus akun pengguna');
  }
}

export async function fetchAdminReports(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/admin/reports`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat laporan moderasi');
  const json = await res.json();
  return json.data;
}

export async function resolveAdminReport(reportId: string, archiveItem: boolean, adminNotes?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/reports/${encodeURIComponent(reportId)}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status: 'RESOLVED', archiveItem, adminNotes }),
  });
  if (!res.ok) throw new Error('Gagal memoderasi laporan');
}

export async function fetchAdminPayouts(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/admin/payouts`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat permintaan pencairan');
  const json = await res.json();
  return json.data;
}

export async function updateAdminPayout(payoutId: string, status: string, adminNotes?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/payouts/${encodeURIComponent(payoutId)}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, adminNotes }),
  });
  if (!res.ok) throw new Error('Gagal memproses pencairan');
}

export interface OfferItem {
  id: string;
  itemId: string;
  buyerId: string;
  sellerId: string;
  offerPriceRupiah: number;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  sellerNote: string | null;
  createdAt: string;
  updatedAt: string;
  item: {
    id: string;
    title: string;
    priceRupiah: number;
    status: string;
    photos: Array<{ id: string; url: string }>;
  };
  buyer?: {
    id: string;
    name: string;
    username: string | null;
    phone: string | null;
  };
  seller?: {
    id: string;
    name: string;
    username: string | null;
  };
}

export async function createOffer(payload: {
  itemId: string;
  offerPriceRupiah: number;
  message?: string | null;
}): Promise<OfferItem> {
  const res = await fetch(`${API_BASE}/offers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Gagal mengirim tawaran');
  return json.data;
}

export async function fetchMyOffers(): Promise<{ asBuyer: OfferItem[]; asSeller: OfferItem[] }> {
  const res = await fetch(`${API_BASE}/offers/my`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Gagal memuat daftar tawaran nego');
  const json = await res.json();
  return json.data;
}

export async function respondToOffer(
  offerId: string,
  action: 'ACCEPT' | 'REJECT',
  sellerNote?: string
): Promise<OfferItem> {
  const res = await fetch(`${API_BASE}/offers/${encodeURIComponent(offerId)}/respond`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, sellerNote }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Gagal merespons tawaran');
  return json.data;
}

export async function cancelOffer(offerId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/offers/${encodeURIComponent(offerId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || 'Gagal membatalkan tawaran');
  }
}
