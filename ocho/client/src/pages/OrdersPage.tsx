import React, { useState, useEffect, useRef } from 'react';
import {
  OrderItem,
  OrderMessageItem,
  OfferItem,
  fetchOrders,
  confirmOrderReceived,
  confirmOrderPayment,
  updateOrderStatus,
  submitReview,
  fetchOrderMessages,
  sendOrderMessage,
  fetchMyOffers,
  respondToOffer,
  cancelOffer,
} from '../services/api';
import { getStoredUser } from '../services/auth';
import { formatRupiah, formatDateTime } from '../utils/format';
import { compressImage } from '../utils/image';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Icon } from '../components/ui/Icon';

interface OrdersPageProps {
  onBackToHome: () => void;
  onViewItem: (itemId: string) => void;
  onCheckoutOffer?: (item: any, offerId: string, offerPrice: number) => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ onBackToHome, onViewItem, onCheckoutOffer }) => {
  const currentUser = getStoredUser();
  const [roleTab, setRoleTab] = useState<'buyer' | 'seller' | 'offers'>('buyer');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Offers State
  const [offersSubTab, setOffersSubTab] = useState<'seller' | 'buyer'>('seller');
  const [offersData, setOffersData] = useState<{ asBuyer: OfferItem[]; asSeller: OfferItem[] }>({ asBuyer: [], asSeller: [] });
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  // QRIS Payment Modal State
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<OrderItem | null>(null);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);

  // Pickup Chat Modal State
  const [chatOrder, setChatOrder] = useState<OrderItem | null>(null);
  const [chatMessages, setChatMessages] = useState<OrderMessageItem[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Review Modal State
  const [reviewOrder, setReviewOrder] = useState<OrderItem | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadOrders = async () => {
    if (roleTab === 'offers') return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrders(roleTab);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat pesanan');
    } finally {
      setLoading(false);
    }
  };

  const loadOffers = async () => {
    setOffersLoading(true);
    setOffersError(null);
    try {
      const data = await fetchMyOffers();
      setOffersData(data);
    } catch (err: any) {
      setOffersError(err.message || 'Gagal memuat tawaran nego');
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => {
    if (roleTab === 'offers') {
      loadOffers();
    } else {
      loadOrders();
    }
  }, [roleTab]);

  const handleRespondOffer = async (offerId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      await respondToOffer(offerId, action);
      await loadOffers();
    } catch (err: any) {
      alert(err.message || 'Gagal merespons tawaran nego');
    }
  };

  const handleCancelOffer = async (offerId: string) => {
    if (!confirm('Batalkan tawaran nego ini?')) return;
    try {
      await cancelOffer(offerId);
      await loadOffers();
    } catch (err: any) {
      alert(err.message || 'Gagal membatalkan tawaran');
    }
  };

  const handleCheckoutOffer = (offer: OfferItem) => {
    if (onCheckoutOffer) {
      onCheckoutOffer(
        {
          id: offer.item.id,
          title: offer.item.title,
          priceRupiah: offer.offerPriceRupiah,
          photos: offer.item.photos,
          seller: offer.seller || { id: offer.sellerId, name: 'Penjual', isVerified: true },
          allowedDeliveryMethod: 'PICKUP_OR_DELIVERY',
          status: 'ACTIVE',
        },
        offer.id,
        offer.offerPriceRupiah
      );
    }
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const compressed = await compressImage(file);
      setPaymentProofUrl(compressed);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses gambar screenshot bukti bayar');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleConfirmPayment = async (orderId: string) => {
    if (!paymentProofUrl) {
      alert('Wajib mengunggah screenshot bukti transfer pembayaran QRIS sebelum konfirmasi.');
      return;
    }
    setConfirmingPay(true);
    try {
      await confirmOrderPayment(orderId, paymentProofUrl);
      setSelectedPaymentOrder(null);
      setPaymentProofUrl(null);
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Gagal mengonfirmasi pembayaran');
    } finally {
      setConfirmingPay(false);
    }
  };

  const openChatModal = async (order: OrderItem) => {
    setChatOrder(order);
    setChatMessages(order.messages || []);
    setChatLoading(true);
    try {
      const msgs = await fetchOrderMessages(order.id);
      setChatMessages(msgs);
    } catch {
      // fallback to preloaded
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || chatInput).trim();
    if (!text || !chatOrder) return;
    setSendingMessage(true);
    try {
      const newMsg = await sendOrderMessage(chatOrder.id, text);
      setChatMessages((prev) => [...prev, newMsg]);
      setChatInput('');
      setOrders((prev) =>
        prev.map((o) =>
          o.id === chatOrder.id
            ? { ...o, messages: [...(o.messages || []), newMsg] }
            : o
        )
      );
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim pesan');
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatOrder]);

  const handleConfirmReceived = async (orderId: string) => {
    if (!confirm('Pastikan barang sudah Anda terima dan periksa kondisinya. Lanjutkan?')) return;
    try {
      await confirmOrderReceived(orderId);
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Gagal mengonfirmasi');
    }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(orderId, status);
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status');
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewOrder) return;
    setSubmittingReview(true);
    try {
      await submitReview({
        orderId: reviewOrder.id,
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviewOrder(null);
      setReviewComment('');
      await loadOrders();
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim ulasan');
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return <Badge variant="warning" size="sm">Menunggu Bayar</Badge>;
      case 'PAID':
        return <Badge variant="info" size="sm">Sudah Dibayar</Badge>;
      case 'PROCESSING':
        return <Badge variant="default" size="sm">Sedang Diproses</Badge>;
      case 'READY_FOR_PICKUP':
        return <Badge variant="info" size="sm">Siap Diambil</Badge>;
      case 'ON_DELIVERY':
        return <Badge variant="info" size="sm">Sedang Diantar</Badge>;
      case 'COMPLETED':
        return <Badge variant="verified" size="sm">Selesai</Badge>;
      case 'CANCELLED':
        return <Badge variant="default" size="sm">Dibatalkan</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-6">
        <div>
          <button
            onClick={onBackToHome}
            className="text-xs font-bold text-brand-blue-600 hover:underline mb-1 inline-block"
          >
            &larr; Kembali ke Beranda
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-brand-text-primary">
            Riwayat Pesanan Ocho
          </h1>
          <p className="text-xs text-brand-text-secondary mt-1">
            Pantau status transaksi jual-beli preloved kamu di kampus Unpad Jatinangor.
          </p>
        </div>

        {/* Role Toggle Tabs */}
        <div className="flex bg-brand-surface dark:bg-slate-800 p-1 rounded-2xl border border-brand-border dark:border-slate-700 flex-wrap gap-1">
          <button
            onClick={() => setRoleTab('buyer')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              roleTab === 'buyer'
                ? 'bg-white dark:bg-slate-900 shadow-xs text-brand-blue-600 dark:text-brand-blue-400'
                : 'text-brand-text-secondary dark:text-slate-400 hover:text-brand-text-primary dark:hover:text-slate-200'
            }`}
          >
            Belanjaan Saya
          </button>
          <button
            onClick={() => setRoleTab('seller')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              roleTab === 'seller'
                ? 'bg-white dark:bg-slate-900 shadow-xs text-brand-blue-600 dark:text-brand-blue-400'
                : 'text-brand-text-secondary dark:text-slate-400 hover:text-brand-text-primary dark:hover:text-slate-200'
            }`}
          >
            Penjualan Saya
          </button>
          <button
            onClick={() => setRoleTab('offers')}
            className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              roleTab === 'offers'
                ? 'bg-white dark:bg-slate-900 shadow-xs text-emerald-600 dark:text-emerald-400'
                : 'text-brand-text-secondary dark:text-slate-400 hover:text-brand-text-primary dark:hover:text-slate-200'
            }`}
          >
            <Icon name="Tag" size={14} />
            <span>Tawaran Nego</span>
            {(offersData.asSeller.filter((o) => o.status === 'PENDING').length > 0 ||
              offersData.asBuyer.filter((o) => o.status === 'ACCEPTED').length > 0) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {roleTab === 'offers' ? (
        <div className="space-y-6">
          {/* Subtabs: Masuk vs Saya */}
          <div className="flex items-center gap-2 border-b border-brand-border/60 dark:border-slate-800 pb-3">
            <button
              onClick={() => setOffersSubTab('seller')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                offersSubTab === 'seller'
                  ? 'bg-brand-blue-50 dark:bg-brand-blue-950/60 text-brand-blue-700 dark:text-brand-blue-300 border border-brand-blue-200 dark:border-brand-blue-800 shadow-xs'
                  : 'text-brand-text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Tawaran Masuk (Sebagai Penjual)</span>
              {offersData.asSeller.filter((o) => o.status === 'PENDING').length > 0 && (
                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {offersData.asSeller.filter((o) => o.status === 'PENDING').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setOffersSubTab('buyer')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                offersSubTab === 'buyer'
                  ? 'bg-brand-blue-50 dark:bg-brand-blue-950/60 text-brand-blue-700 dark:text-brand-blue-300 border border-brand-blue-200 dark:border-brand-blue-800 shadow-xs'
                  : 'text-brand-text-secondary dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Tawaran Saya (Sebagai Pembeli)</span>
              {offersData.asBuyer.filter((o) => o.status === 'ACCEPTED').length > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {offersData.asBuyer.filter((o) => o.status === 'ACCEPTED').length} Siap Beli
                </span>
              )}
            </button>
          </div>

          {offersLoading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-brand-border dark:border-slate-800 animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/4"></div>
                  <div className="h-16 bg-gray-100 dark:bg-slate-800/60 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : offersError ? (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-6 rounded-2xl text-center space-y-2">
              <Icon name="WarningCircle" size={24} className="mx-auto text-red-500" />
              <p className="text-sm font-bold">{offersError}</p>
              <Button variant="outline" size="sm" onClick={loadOffers}>Coba Lagi</Button>
            </div>
          ) : offersSubTab === 'seller' ? (
            offersData.asSeller.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-brand-border dark:border-slate-800 p-12 text-center space-y-3 shadow-card">
                <div className="w-16 h-16 rounded-full bg-brand-surface dark:bg-slate-800 text-brand-text-secondary dark:text-slate-400 flex items-center justify-center mx-auto border border-brand-border dark:border-slate-700">
                  <Icon name="Tag" size={24} />
                </div>
                <h3 className="font-display font-bold text-base text-brand-text-primary dark:text-slate-100">
                  Belum Ada Tawaran Nego Masuk
                </h3>
                <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-sm mx-auto">
                  Tawaran harga dari calon pembeli untuk barang yang Anda buka opsi negonya akan muncul di sini.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {offersData.asSeller.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-brand-border dark:border-slate-800 p-5 shadow-card space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/60 dark:border-slate-800 pb-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-brand-text-primary dark:text-slate-200">
                          Dari: @{offer.buyer?.username || offer.buyer?.name || 'Mahasiswa'}
                        </span>
                        <span className="text-brand-text-secondary dark:text-slate-500">&bull;</span>
                        <span className="text-brand-text-secondary dark:text-slate-400">
                          {formatDateTime(offer.createdAt)}
                        </span>
                      </div>
                      <div>
                        {offer.status === 'PENDING' && (
                          <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Menunggu Persetujuan Anda
                          </span>
                        )}
                        {offer.status === 'ACCEPTED' && (
                          <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Tawaran Diterima
                          </span>
                        )}
                        {offer.status === 'REJECTED' && (
                          <span className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-700 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Tawaran Ditolak
                          </span>
                        )}
                        {offer.status === 'COMPLETED' && (
                          <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Sudah Dibeli & Selesai
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      {offer.item.photos[0]?.url && (
                        <img
                          src={offer.item.photos[0].url}
                          alt=""
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-brand-border shrink-0 cursor-pointer"
                          onClick={() => onViewItem(offer.itemId)}
                        />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4
                          className="font-display font-bold text-sm text-brand-text-primary dark:text-slate-100 truncate cursor-pointer hover:text-brand-blue-600"
                          onClick={() => onViewItem(offer.itemId)}
                        >
                          {offer.item.title}
                        </h4>
                        <div className="flex items-baseline gap-2 pt-1 flex-wrap">
                          <span className="text-xs text-brand-text-secondary dark:text-slate-400 line-through">
                            {formatRupiah(offer.item.priceRupiah)}
                          </span>
                          <span className="font-display font-black text-base text-emerald-600 dark:text-emerald-400">
                            Tawaran: {formatRupiah(offer.offerPriceRupiah)}
                          </span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded font-bold">
                            Hemat {formatRupiah(offer.item.priceRupiah - offer.offerPriceRupiah)}
                          </span>
                        </div>
                        {offer.message && (
                          <p className="text-xs italic text-brand-text-secondary dark:text-slate-400 bg-brand-surface dark:bg-slate-800 p-2 rounded-lg mt-1 border border-brand-border/60 dark:border-slate-700">
                            "{offer.message}"
                          </p>
                        )}
                      </div>
                    </div>

                    {offer.status === 'PENDING' && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-brand-border/60 dark:border-slate-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRespondOffer(offer.id, 'REJECT')}
                        >
                          Tolak Tawaran
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRespondOffer(offer.id, 'ACCEPT')}
                        >
                          Terima Tawaran ({formatRupiah(offer.offerPriceRupiah)})
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            offersData.asBuyer.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-brand-border dark:border-slate-800 p-12 text-center space-y-3 shadow-card">
                <div className="w-16 h-16 rounded-full bg-brand-surface dark:bg-slate-800 text-brand-text-secondary dark:text-slate-400 flex items-center justify-center mx-auto border border-brand-border dark:border-slate-700">
                  <Icon name="Tag" size={24} />
                </div>
                <h3 className="font-display font-bold text-base text-brand-text-primary dark:text-slate-100">
                  Belum Ada Tawaran Nego yang Anda Ajukan
                </h3>
                <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-sm mx-auto">
                  Anda dapat mengajukan penawaran harga untuk barang yang memiliki label "Bisa Nego".
                </p>
                <Button variant="primary" size="sm" onClick={onBackToHome}>
                  Cari Barang Sekarang
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {offersData.asBuyer.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-brand-border dark:border-slate-800 p-5 shadow-card space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/60 dark:border-slate-800 pb-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-brand-text-primary dark:text-slate-200">
                          Penjual: @{offer.seller?.username || offer.seller?.name || 'Mahasiswa'}
                        </span>
                        <span className="text-brand-text-secondary dark:text-slate-500">&bull;</span>
                        <span className="text-brand-text-secondary dark:text-slate-400">
                          {formatDateTime(offer.createdAt)}
                        </span>
                      </div>
                      <div>
                        {offer.status === 'PENDING' && (
                          <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Menunggu Respons Penjual
                          </span>
                        )}
                        {offer.status === 'ACCEPTED' && (
                          <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Tawaran Disetujui!
                          </span>
                        )}
                        {offer.status === 'REJECTED' && (
                          <span className="bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Tawaran Ditolak
                          </span>
                        )}
                        {offer.status === 'COMPLETED' && (
                          <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 text-xs font-bold px-2 py-0.5 rounded-lg">
                            Sudah Dipesan
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      {offer.item.photos[0]?.url && (
                        <img
                          src={offer.item.photos[0].url}
                          alt=""
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-brand-border shrink-0 cursor-pointer"
                          onClick={() => onViewItem(offer.itemId)}
                        />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4
                          className="font-display font-bold text-sm text-brand-text-primary dark:text-slate-100 truncate cursor-pointer hover:text-brand-blue-600"
                          onClick={() => onViewItem(offer.itemId)}
                        >
                          {offer.item.title}
                        </h4>
                        <div className="flex items-baseline gap-2 pt-1 flex-wrap">
                          <span className="text-xs text-brand-text-secondary dark:text-slate-400 line-through">
                            {formatRupiah(offer.item.priceRupiah)}
                          </span>
                          <span className="font-display font-black text-base text-emerald-600 dark:text-emerald-400">
                            Tawaran Kamu: {formatRupiah(offer.offerPriceRupiah)}
                          </span>
                        </div>
                        {offer.message && (
                          <p className="text-xs italic text-brand-text-secondary dark:text-slate-400 bg-brand-surface dark:bg-slate-800 p-2 rounded-lg mt-1 border border-brand-border/60 dark:border-slate-700">
                            "{offer.message}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-brand-border/60 dark:border-slate-800">
                      {offer.status === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelOffer(offer.id)}
                        >
                          Batalkan Tawaran
                        </Button>
                      )}
                      {offer.status === 'ACCEPTED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleCheckoutOffer(offer)}
                        >
                          Beli Sekarang dengan Harga Nego ({formatRupiah(offer.offerPriceRupiah)})
                        </Button>
                      )}
                      {offer.status === 'REJECTED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewItem(offer.itemId)}
                        >
                          Lihat Barang
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-brand-border dark:border-slate-800 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-1/4"></div>
              <div className="h-16 bg-gray-100 dark:bg-slate-800/60 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-6 rounded-2xl text-center space-y-2">
          <Icon name="WarningCircle" size={24} className="mx-auto text-red-500" />
          <p className="text-sm font-bold">{error}</p>
          <Button variant="outline" size="sm" onClick={loadOrders}>
            Coba Lagi
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-brand-border dark:border-slate-800 p-12 text-center space-y-3 shadow-card">
          <div className="w-16 h-16 rounded-full bg-brand-surface dark:bg-slate-800 text-brand-text-secondary dark:text-slate-400 flex items-center justify-center mx-auto border border-brand-border dark:border-slate-700">
            <Icon name="Package" size={24} />
          </div>
          <h3 className="font-display font-bold text-base text-brand-text-primary dark:text-slate-100">
            Belum Ada Pesanan {roleTab === 'buyer' ? 'Pembelian' : 'Penjualan'}
          </h3>
          <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-sm mx-auto">
            {roleTab === 'buyer'
              ? 'Temukan barang preloved kos, buku, atau fashion favoritmu di marketplace Ocho.'
              : 'Barang yang kamu iklankan belum ada yang memesan. Pastikan hargamu bersaing!'}
          </p>
          {roleTab === 'buyer' && (
            <Button variant="primary" size="sm" onClick={onBackToHome}>
              Mulai Cari Barang
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-brand-border dark:border-slate-800 p-5 shadow-card hover:border-gray-300 dark:hover:border-slate-700 transition-all space-y-4"
            >
              {/* Order Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/60 dark:border-slate-800 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-brand-text-primary dark:text-slate-100">
                    {order.orderNumber}
                  </span>
                  <span className="text-brand-text-secondary dark:text-slate-500">&bull;</span>
                  <span className="text-brand-text-secondary dark:text-slate-400">
                    {formatDateTime(order.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-brand-text-secondary dark:text-slate-400">
                    Metode: <strong className="text-brand-text-primary dark:text-slate-200">{order.paymentMethod}</strong> ({order.deliveryMethod})
                  </span>
                  {getStatusBadge(order.status)}
                </div>
              </div>

              {/* Item Info */}
              <div className="flex items-start gap-4">
                <img
                  src={order.item.photos[0]?.url}
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-brand-border shrink-0 cursor-pointer"
                  onClick={() => onViewItem(order.itemId)}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <h4
                    className="font-display font-bold text-sm sm:text-base text-brand-text-primary hover:text-brand-blue-600 cursor-pointer truncate"
                    onClick={() => onViewItem(order.itemId)}
                  >
                    {order.item.title}
                  </h4>
                  <p className="text-xs text-brand-text-secondary dark:text-slate-400">
                    {roleTab === 'buyer' ? (
                      <>
                        Penjual:{' '}
                        <strong className="text-brand-text-primary dark:text-slate-200">
                          {order.seller.username
                            ? `@${order.seller.username}`
                            : `@${order.seller.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                        </strong>
                      </>
                    ) : (
                      <>
                        Pembeli:{' '}
                        <strong className="text-brand-text-primary dark:text-slate-200">
                          {order.buyer.username
                            ? `@${order.buyer.username}`
                            : `@${order.buyer.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                        </strong>{' '}
                        ({order.buyerPhone})
                      </>
                    )}
                  </p>
                  {order.deliveryAddress && (
                    <p className="text-xs text-brand-text-secondary flex items-center gap-1">
                      <Icon name="Truck" size={16} className="text-brand-blue-600 shrink-0" />
                      <span className="truncate">Antar ke: {order.deliveryAddress}</span>
                    </p>
                  )}
                  {order.deliveryDate && (
                    <p className="text-xs text-brand-text-secondary flex items-center gap-1">
                      <Icon name="Calendar" size={16} className="text-brand-blue-600 shrink-0" />
                      <span>
                        Jadwal Antar: <strong className="text-brand-text-primary">{new Date(order.deliveryDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                      </span>
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-[11px] text-brand-text-secondary">Total Transaksi</p>
                  <p className="font-display font-black text-brand-orange text-sm sm:text-base tabular-nums">
                    {formatRupiah(roleTab === 'buyer' ? order.buyerTotalRupiah : order.sellerPayoutRupiah)}
                  </p>
                  {roleTab === 'seller' && (
                    <p className="text-[10px] text-emerald-700">
                      Setelah potong komisi 20%
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons based on status & role */}
              <div className="pt-2 border-t border-brand-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-brand-text-secondary">
                  {order.status === 'PENDING_PAYMENT' && order.reservedUntil && (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      <Icon name="Clock" size={16} className="text-amber-600" />
                      <span>Selesaikan bayar sebelum {new Date(order.reservedUntil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  )}
                  {order.status === 'COMPLETED' && order.review && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      <Icon name="Star" size={16} weight="fill" className="text-amber-400" />
                      <span>Ulasan {order.review.rating}/5: &ldquo;{order.review.comment}&rdquo;</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Pickup Janjian Chat & WhatsApp */}
                  {order.deliveryMethod === 'PICKUP' && ['PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED'].includes(order.status) && (
                    <>
                      {(() => {
                        const targetPhone = roleTab === 'buyer' ? order.seller.phone : order.buyerPhone;
                        if (!targetPhone) return null;
                        const cleanPhone = targetPhone.replace(/^0/, '62').replace(/\D/g, '');
                        const waText = encodeURIComponent(
                          `Halo kak, saya ${roleTab === 'buyer' ? 'pembeli' : 'penjual'} barang "${order.item.title}" di Ocho (#${order.orderNumber}). Mau janjian waktu dan titik temu pickup di kampus.`
                        );
                        return (
                          <a
                            href={`https://wa.me/${cleanPhone}?text=${waText}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors shrink-0"
                          >
                            <Icon name="WhatsappLogo" size={16} weight="fill" />
                            <span>WhatsApp {roleTab === 'buyer' ? 'Penjual' : 'Pembeli'}</span>
                          </a>
                        );
                      })()}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openChatModal(order)}
                      >
                        <Icon name="ChatCircleDots" size={16} className="mr-1 text-brand-blue-600" />
                        Chat Janjian Pickup {order.messages && order.messages.length > 0 && `(${order.messages.length})`}
                      </Button>
                    </>
                  )}

                  {/* Buyer: Pay QRIS */}
                  {roleTab === 'buyer' && order.status === 'PENDING_PAYMENT' && order.paymentMethod === 'QRIS' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedPaymentOrder(order)}
                    >
                      <Icon name="QrCode" size={16} className="mr-1" />
                      Bayar QRIS
                    </Button>
                  )}

                  {/* Buyer: Confirm Received */}
                  {roleTab === 'buyer' && ['ON_DELIVERY', 'READY_FOR_PICKUP', 'PROCESSING', 'PAID'].includes(order.status) && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleConfirmReceived(order.id)}
                    >
                      <Icon name="CheckCircle" size={16} weight="fill" className="mr-1" />
                      Barang Sudah Diterima
                    </Button>
                  )}

                  {/* Buyer: Write Review */}
                  {roleTab === 'buyer' && order.status === 'COMPLETED' && !order.review && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReviewOrder(order);
                        setReviewRating(5);
                        setReviewComment('');
                      }}
                    >
                      <Icon name="Star" size={16} className="mr-1" />
                      Beri Ulasan Penjual
                    </Button>
                  )}

                  {/* Seller: Update Status Progression */}
                  {roleTab === 'seller' && (
                    <>
                      {order.status === 'PAID' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleStatusChange(order.id, 'PROCESSING')}
                        >
                          Mulai Kemas Barang
                        </Button>
                      )}
                      {order.status === 'PROCESSING' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            handleStatusChange(
                              order.id,
                              order.deliveryMethod === 'PICKUP' ? 'READY_FOR_PICKUP' : 'ON_DELIVERY'
                            )
                          }
                        >
                          {order.deliveryMethod === 'PICKUP' ? 'Tandai Siap Diambil' : 'Kirim dengan Kurir'}
                        </Button>
                      )}
                    </>
                  )}

                  {/* View Payment Proof (Buyer or Seller) */}
                  {order.paymentProofUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingProofUrl(order.paymentProofUrl!)}
                    >
                      <Icon name="FileText" size={16} className="mr-1 text-brand-blue-600" />
                      Lihat Bukti Bayar
                    </Button>
                  )}

                  {/* Cancel Order */}
                  {['PENDING_PAYMENT', 'PROCESSING'].includes(order.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                    >
                      Batalkan
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Real QRIS Payment Modal */}
      {selectedPaymentOrder && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedPaymentOrder(null);
            setPaymentProofUrl(null);
          }}
          title="Pembayaran QRIS Ocho"
          description={`Scan QRIS resmi untuk pesanan #${selectedPaymentOrder.orderNumber}`}
        >
          <div className="py-4 text-center space-y-4">
            <div className="bg-white p-3 rounded-2xl border border-brand-border inline-block mx-auto text-center space-y-2 max-w-[280px] shadow-sm">
              <img
                src="/qris.jpg"
                alt="QRIS Ocho Resmi"
                className="w-full h-auto rounded-xl object-contain mx-auto border border-brand-border/40"
              />
              <div className="text-[11px] font-mono font-bold text-brand-blue-700 bg-brand-surface py-1 px-2 rounded-lg">
                NMID: ID1026493553733
              </div>
              <p className="text-[11px] text-brand-text-secondary leading-tight">
                Bisa di-scan dari GoPay, BCA, Mandiri, BNI, BRI, OVO, atau Dana.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-brand-text-secondary">Total Tagihan:</p>
              <p className="font-display font-black text-2xl text-brand-orange tabular-nums">
                {formatRupiah(selectedPaymentOrder.buyerTotalRupiah)}
              </p>
              <p className="text-[11px] text-brand-text-secondary">
                Pastikan nominal transfer sesuai dengan total tagihan di atas.
              </p>
            </div>

            {/* Upload Bukti Pembayaran */}
            <div className="bg-brand-surface p-3.5 rounded-2xl border border-brand-border space-y-2.5 text-left">
              <label className="block text-xs font-bold text-brand-text-primary flex items-center gap-1.5">
                <Icon name="UploadSimple" size={16} className="text-brand-blue-600" />
                <span>Unggah Screenshot Bukti Transfer *</span>
              </label>
              <p className="text-[11px] text-brand-text-secondary leading-snug">
                Wajib melampirkan screenshot atau foto resi pembayaran QRIS sebagai bukti konfirmasi transaksi.
              </p>

              {paymentProofUrl ? (
                <div className="space-y-2">
                  <div className="relative border border-brand-border rounded-xl overflow-hidden bg-white p-2">
                    <img
                      src={paymentProofUrl}
                      alt="Bukti Transfer"
                      className="max-h-48 w-auto mx-auto rounded-lg object-contain"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Icon name="CheckCircle" size={16} weight="fill" />
                      Bukti transfer berhasil dipilih
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaymentProofUrl(null)}
                      className="text-red-600 hover:underline font-bold text-[11px]"
                    >
                      Ganti Screenshot
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-brand-blue-300 hover:border-brand-blue-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-white transition-colors">
                  <Icon name="UploadSimple" size={24} className="text-brand-blue-600 mb-1" />
                  <span className="text-xs font-bold text-brand-blue-700">
                    {uploadingProof ? 'Memproses gambar...' : 'Klik untuk Unggah Screenshot Bukti'}
                  </span>
                  <span className="text-[10px] text-brand-text-secondary mt-0.5">
                    Format JPG, PNG, atau JPEG
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingProof}
                    onChange={handleProofFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPaymentOrder(null);
                  setPaymentProofUrl(null);
                }}
              >
                Tutup
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={confirmingPay || !paymentProofUrl || uploadingProof}
                onClick={() => handleConfirmPayment(selectedPaymentOrder.id)}
              >
                {confirmingPay ? 'Memverifikasi...' : 'Saya Sudah Membayar & Kirim Bukti'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pickup Janjian Chat Modal */}
      {chatOrder && (
        <Modal
          isOpen={true}
          onClose={() => setChatOrder(null)}
          title="Chat Janjian Titik Temu (Pickup)"
          description={`Pesanan #${chatOrder.orderNumber} - ${chatOrder.item.title}`}
        >
          <div className="space-y-4 py-2">
            {/* Header info about counterpart */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-brand-surface dark:bg-slate-800 rounded-xl border border-brand-border dark:border-slate-700 text-xs">
              <div>
                <span className="text-brand-text-secondary dark:text-slate-400">
                  {roleTab === 'buyer' ? 'Penjual: ' : 'Pembeli: '}
                </span>
                <strong className="text-brand-text-primary dark:text-slate-200">
                  {roleTab === 'buyer'
                    ? chatOrder.seller.username
                      ? `@${chatOrder.seller.username}`
                      : `@${chatOrder.seller.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
                    : chatOrder.buyer.username
                    ? `@${chatOrder.buyer.username}`
                    : `@${chatOrder.buyer.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                </strong>
                {roleTab === 'buyer' && chatOrder.seller.isVerified && (
                  <span className="ml-1.5 inline-flex items-center text-[10px] text-brand-blue-600 dark:text-brand-blue-400 bg-brand-blue-50 dark:bg-brand-blue-950/60 px-1.5 py-0.5 rounded-full font-bold">
                    Terverifikasi
                  </span>
                )}
              </div>

              {(() => {
                const targetPhone = roleTab === 'buyer' ? chatOrder.seller.phone : chatOrder.buyerPhone;
                if (!targetPhone) return null;
                const cleanPhone = targetPhone.replace(/^0/, '62').replace(/\D/g, '');
                const waText = encodeURIComponent(
                  `Halo kak, saya ${roleTab === 'buyer' ? 'pembeli' : 'penjual'} barang "${chatOrder.item.title}" di Ocho (#${chatOrder.orderNumber}). Mau janjian waktu dan titik temu pickup di kampus.`
                );
                return (
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${waText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
                  >
                    <Icon name="WhatsappLogo" size={14} weight="fill" />
                    <span>WhatsApp</span>
                  </a>
                );
              })()}
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1">
              <span className="text-[11px] text-brand-text-secondary font-medium">Template pesan cepat:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Bisa janjian di Bale Sawala?',
                  'Bisa ketemu di Gerbang Lama (Gerlam)?',
                  'Bisa ketemu di Perpustakaan Pusat?',
                  'Saya sudah di lokasi janjian ya!',
                ].map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => handleSendMessage(template)}
                    className="text-[11px] bg-white border border-brand-border/80 hover:border-brand-blue-400 hover:text-brand-blue-600 px-2.5 py-1 rounded-full transition-colors"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages Container */}
            <div
              ref={chatScrollRef}
              className="bg-brand-surface/60 border border-brand-border rounded-2xl p-3 h-64 overflow-y-auto space-y-2.5"
            >
              {chatLoading ? (
                <div className="flex items-center justify-center h-full text-xs text-brand-text-secondary">
                  Memuat riwayat chat...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4 space-y-1 text-xs text-brand-text-secondary">
                  <Icon name="ChatCircleDots" size={24} className="text-brand-text-secondary/60 mb-1" />
                  <p className="font-bold text-brand-text-primary">Belum ada percakapan</p>
                  <p>Mulai janjian lokasi dan jam temu pengambilan barang di kampus Unpad.</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-brand-text-secondary dark:text-slate-400 mb-0.5">
                        <span className="font-bold">
                          {isMe
                            ? 'Anda'
                            : msg.sender?.username
                            ? `@${msg.sender.username}`
                            : msg.sender?.name
                            ? `@${msg.sender.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
                            : 'Mahasiswa'}
                        </span>
                        <span>&bull;</span>
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </div>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          isMe
                            ? 'bg-brand-blue-600 text-white rounded-tr-xs shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 border border-brand-border dark:border-slate-700 rounded-tl-xs shadow-xs'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Send Message Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2 pt-1"
            >
              <input
                type="text"
                placeholder="Ketik pesan janjian atau titik temu..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-brand-surface border border-brand-border rounded-xl focus:border-brand-blue-500 focus:bg-white focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={sendingMessage || !chatInput.trim()}
              >
                <Icon name="PaperPlaneRight" size={16} weight="fill" className="mr-1" />
                {sendingMessage ? 'Mengirim...' : 'Kirim'}
              </Button>
            </form>
          </div>
        </Modal>
      )}

      {/* Bukti Transfer Viewer Modal */}
      {viewingProofUrl && (
        <Modal
          isOpen={true}
          onClose={() => setViewingProofUrl(null)}
          title="Bukti Transfer Pembayaran QRIS"
          description="Foto struk atau screenshot transaksi yang diunggah oleh pembeli."
        >
          <div className="py-2 space-y-4 text-center">
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-2 overflow-hidden max-h-[70vh] flex items-center justify-center">
              <img
                src={viewingProofUrl}
                alt="Bukti Transfer QRIS"
                className="max-h-[65vh] w-auto mx-auto object-contain rounded-xl shadow-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={() => setViewingProofUrl(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Review Modal */}
      {reviewOrder && (
        <Modal
          isOpen={true}
          onClose={() => setReviewOrder(null)}
          title="Beri Ulasan Penjual"
          description={`Bagikan pengalaman belanjamu dari ${
            reviewOrder.seller.username
              ? `@${reviewOrder.seller.username}`
              : `@${reviewOrder.seller.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`
          }`}
        >
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-bold text-brand-text-primary mb-2 text-center">
                Bintang Kepuasan (1 - 5)
              </label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Icon
                      name="Star"
                      size={24}
                      weight={star <= reviewRating ? 'fill' : 'regular'}
                      className={
                        star <= reviewRating
                          ? 'text-amber-400'
                          : 'text-gray-300'
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-text-primary mb-1">
                Komentar Ulasan
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Barangnya bersih dan berfungsi normal, penjual ramah dan tepat waktu saat COD..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-surface border border-brand-border rounded-xl focus:border-brand-blue-500 focus:bg-white focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setReviewOrder(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={submittingReview}
                onClick={handleSubmitReview}
              >
                {submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bukti Transfer Viewer Modal */}
      {viewingProofUrl && (
        <Modal
          isOpen={true}
          onClose={() => setViewingProofUrl(null)}
          title="Bukti Transfer Pembayaran QRIS"
          description="Foto struk atau screenshot transaksi yang diunggah oleh pembeli."
        >
          <div className="py-2 space-y-4 text-center">
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-2 overflow-hidden max-h-[70vh] flex items-center justify-center">
              <img
                src={viewingProofUrl}
                alt="Bukti Transfer QRIS"
                className="max-h-[65vh] w-auto mx-auto object-contain rounded-xl shadow-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={() => setViewingProofUrl(null)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
