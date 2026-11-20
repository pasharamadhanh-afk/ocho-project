import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { RupiahInput } from './Input';
import { Icon } from './Icon';
import { ItemDetail, createOffer } from '../../services/api';
import { formatRupiah } from '../../utils/format';

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemDetail;
  onSuccess: () => void;
}

export const OfferModal: React.FC<OfferModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
}) => {
  // Default offer: ~85% of price rounded to nearest thousand
  const defaultOffer = Math.max(1000, Math.round((item.priceRupiah * 0.85) / 1000) * 1000);
  const [offerPrice, setOfferPrice] = useState<number>(defaultOffer);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const discount = Math.max(0, item.priceRupiah - offerPrice);
  const discountPercent = item.priceRupiah > 0 ? Math.round((discount / item.priceRupiah) * 100) : 0;
  const minAllowed = Math.floor(item.priceRupiah * 0.3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (offerPrice >= item.priceRupiah) {
      setError('Harga tawaran nego harus lebih rendah dari harga awal.');
      return;
    }

    if (offerPrice < minAllowed) {
      setError(`Tawaran terlalu rendah. Minimal penawaran wajar adalah ${formatRupiah(minAllowed)} (30% dari harga awal).`);
      return;
    }

    setSubmitting(true);
    try {
      await createOffer({
        itemId: item.id,
        offerPriceRupiah: offerPrice,
        message: message.trim() || null,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim tawaran nego.');
    } finally {
      setSubmitting(false);
    }
  };

  const primaryPhoto = item.photos[0]?.url;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nego Harga Barang"
      description="Ajukan harga tawaranmu ke penjual. Jika disetujui, kamu bisa langsung checkout dengan harga nego!"
    >
      {success ? (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
            <Icon name="CheckCircle" size={24} weight="fill" />
          </div>
          <h4 className="font-display font-bold text-sm text-brand-text-primary dark:text-slate-100">
            Tawaran Nego Berhasil Dikirim!
          </h4>
          <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-xs mx-auto">
            Penjual akan menerima notifikasi tawaran Anda. Cek status tawaran kapan saja di menu Pesanan &gt; Tawaran Nego.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
              <Icon name="WarningCircle" size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Preview */}
          <div className="flex items-center gap-3 p-3 bg-brand-surface dark:bg-slate-800/60 rounded-xl border border-brand-border dark:border-slate-700">
            {primaryPhoto && (
              <img
                src={primaryPhoto}
                alt=""
                className="w-14 h-14 rounded-lg object-cover shrink-0 border border-brand-border dark:border-slate-700"
              />
            )}
            <div className="min-w-0 space-y-0.5">
              <h4 className="font-display font-bold text-xs text-brand-text-primary dark:text-slate-100 truncate">
                {item.title}
              </h4>
              <p className="text-[11px] text-brand-text-secondary dark:text-slate-400">
                Penjual: @{item.seller.username || item.seller.name}
              </p>
              <p className="text-xs font-bold text-brand-orange">
                Harga Pas Awal: {formatRupiah(item.priceRupiah)}
              </p>
            </div>
          </div>

          {/* Price Offer Input */}
          <div className="bg-brand-surface dark:bg-slate-800/50 p-3.5 rounded-2xl border border-brand-border dark:border-slate-700/80 space-y-2.5">
            <RupiahInput
              label="Harga Tawaran Kamu"
              value={offerPrice}
              onChange={setOfferPrice}
              helperText={`Minimal tawaran wajar: ${formatRupiah(minAllowed)}`}
            />

            {discount > 0 && offerPrice < item.priceRupiah && (
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span>Potongan yang Diajukan:</span>
                <span>-{formatRupiah(discount)} ({discountPercent}%)</span>
              </div>
            )}
          </div>

          {/* Optional Message */}
          <div>
            <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
              Pesan ke Penjual (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Bisa COD di Gerlam kak? Langsung bungkus hari ini..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-brand-border dark:border-slate-800">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Mengirim...' : 'Kirim Tawaran Nego'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
