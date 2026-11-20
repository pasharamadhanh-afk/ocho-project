import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { RupiahInput } from './Input';
import { Category, fetchCategories, createItem } from '../../services/api';
import { formatRupiah } from '../../utils/format';
import { Icon } from './Icon';

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1000;
        let { width, height } = img;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceRupiah, setPriceRupiah] = useState<number>(50000);
  const [condition, setCondition] = useState<'BARU' | 'SEPERTI_BARU' | 'BEKAS_BAIK' | 'BEKAS_CUKUP'>('BEKAS_BAIK');
  const [size, setSize] = useState('');
  const [brand, setBrand] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP_ONLY' | 'PICKUP_OR_DELIVERY'>('PICKUP_OR_DELIVERY');
  const [pickupLocation, setPickupLocation] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCategories().then((cats) => {
        setCategories(cats);
        if (cats.length > 0 && !categoryId) {
          setCategoryId(cats[0].id);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Automatically enforce PICKUP_ONLY if category specifies
  useEffect(() => {
    if (selectedCategory?.allowedDelivery === 'PICKUP_ONLY') {
      setDeliveryMethod('PICKUP_ONLY');
    }
  }, [selectedCategory]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 6) {
      setError('Maksimal 6 foto barang.');
      return;
    }

    const compressedPhotos: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 12 * 1024 * 1024) {
        setError('Ukuran foto terlalu besar (maks 12 MB).');
        continue;
      }
      const dataUrl = await compressImage(file);
      if (dataUrl) compressedPhotos.push(dataUrl);
    }

    setPhotos((prev) => [...prev, ...compressedPhotos].slice(0, 6));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Commission is 20%
  const commission = Math.round(priceRupiah * 0.20);
  const sellerPayout = Math.max(0, priceRupiah - commission);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedCategory?.requiresSize && !size.trim()) {
      setError(`Kategori ${selectedCategory.name} wajib menyertakan ukuran (misal: S, M, L, XL, atau no. sepatu).`);
      return;
    }

    setLoading(true);
    try {
      await createItem({
        title,
        description,
        categoryId,
        priceRupiah,
        condition,
        size: size.trim() || null,
        brand: brand.trim() || null,
        allowedDeliveryMethod: deliveryMethod,
        pickupLocation: pickupLocation.trim() || null,
        isNegotiable,
        photos,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal mengunggah barang.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Jual Barang Preloved Kamu"
      description="Pasang iklan gratis khusus sesama mahasiswa Unpad. Komisi 20% otomatis dipotong saat barang laku."
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1 max-h-[75vh] overflow-y-auto px-1">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-start gap-2">
            <Icon name="WarningCircle" size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Photo Uploader */}
        <div>
          <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1.5">
            Foto Barang (Maks. 6 Foto)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {photos.map((url, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-brand-border dark:border-slate-700 group">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-80 hover:opacity-100"
                  aria-label="Hapus foto"
                >
                  <Icon name="X" size={16} ariaHidden />
                </button>
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 bg-brand-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    Utama
                  </span>
                )}
              </div>
            ))}

            {photos.length < 6 && (
              <label className="border-2 border-dashed border-brand-border dark:border-slate-700 rounded-xl aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-brand-blue-500 hover:bg-brand-blue-50/50 dark:hover:bg-slate-800/60 transition-colors">
                <Icon name="UploadSimple" size={20} className="text-brand-text-secondary dark:text-slate-400 mb-1" />
                <span className="text-[10px] text-brand-text-secondary dark:text-slate-400 font-medium">Unggah</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* 2. Title & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
              Judul Barang <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Kipas Angin Miyako KAS-1618B"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id} disabled={c.isForbidden}>
                  {c.name} {c.allowedDelivery === 'PICKUP_ONLY' ? '(Pickup Saja)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Condition & Size/Brand */}
        <div>
          <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1.5">
            Kondisi Barang <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { val: 'BARU', label: 'Baru', desc: 'Belum pernah dipakai' },
              { val: 'SEPERTI_BARU', label: 'Seperti Baru', desc: 'Mulus 95%+' },
              { val: 'BEKAS_BAIK', label: 'Bekas Baik', desc: 'Fungsi 100% normal' },
              { val: 'BEKAS_CUKUP', label: 'Bekas Cukup', desc: 'Ada tanda pakai' },
            ].map((c) => (
              <button
                type="button"
                key={c.val}
                onClick={() => setCondition(c.val as any)}
                className={`p-2 rounded-xl text-left border transition-all ${
                  condition === c.val
                    ? 'border-brand-blue-600 dark:border-brand-blue-500 bg-brand-blue-50/50 dark:bg-brand-blue-950/40 text-brand-blue-900 dark:text-brand-blue-200'
                    : 'border-brand-border dark:border-slate-700 bg-white dark:bg-slate-800/80 text-brand-text-secondary dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <p className="text-xs font-bold">{c.label}</p>
                <p className="text-[10px] text-brand-text-secondary dark:text-slate-400">{c.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Size (Mandatory if Fashion) & Brand */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
              Ukuran {selectedCategory?.requiresSize && <span className="text-red-500">*(Wajib untuk Fashion)</span>}
            </label>
            <input
              type="text"
              placeholder="Contoh: L, XL, atau 42"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
              Merek / Brand (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Uniqlo, Miyako, Casio"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* 4. Description */}
        <div>
          <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
            Deskripsi Barang <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            placeholder="Jelaskan kondisi kelengkapan barang, alasan jual, lama pemakaian..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none resize-none"
          />
        </div>

        {/* 5. Price & Financial Breakdown (Transparent Commission) */}
        <div className="bg-brand-surface dark:bg-slate-800/50 p-3.5 rounded-2xl border border-brand-border dark:border-slate-700/80 space-y-3">
          <RupiahInput
            label="Harga Jual Barang"
            value={priceRupiah}
            onChange={setPriceRupiah}
            helperText="Harga yang akan dilihat dan dibayar oleh pembeli."
          />

          {/* Nego Harga Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-brand-border dark:border-slate-700 cursor-pointer hover:border-brand-blue-400 dark:hover:border-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={isNegotiable}
              onChange={(e) => setIsNegotiable(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-blue-600 focus:ring-brand-blue-500 cursor-pointer shrink-0"
            />
            <div className="select-none">
              <span className="block text-xs font-bold text-brand-text-primary dark:text-slate-100 flex items-center gap-1.5">
                <span>Izinkan Calon Pembeli Nego Harga</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                  Bisa Nego
                </span>
              </span>
              <span className="block text-[11px] text-brand-text-secondary dark:text-slate-400 mt-0.5 leading-snug">
                Tombol "Nego Harga" akan tampil di barang Anda. Anda dapat menyetujui atau menolak tawaran harga yang diajukan pembeli.
              </span>
            </div>
          </label>

          <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-brand-border/80 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between text-brand-text-secondary dark:text-slate-400">
              <span>Komisi Platform Ocho (20%):</span>
              <span className="font-bold text-red-600 dark:text-red-400">- {formatRupiah(commission)}</span>
            </div>
            <div className="border-t border-brand-border dark:border-slate-700 pt-2 flex justify-between font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-lg">
              <span>Uang yang Kamu Terima:</span>
              <span className="text-sm font-black">{formatRupiah(sellerPayout)}</span>
            </div>
            <p className="text-[10px] text-brand-text-secondary dark:text-slate-400 leading-tight">
              Komisi dipotong otomatis saat barang laku dan pembeli menyelesaikan pesanan. Bebas biaya penarikan ke rekening bank/e-wallet.
            </p>
          </div>
        </div>

        {/* 6. Delivery Options */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200">
            Opsi Pengambilan Barang
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeliveryMethod('PICKUP_OR_DELIVERY')}
              disabled={selectedCategory?.allowedDelivery === 'PICKUP_ONLY'}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                deliveryMethod === 'PICKUP_OR_DELIVERY'
                  ? 'border-brand-blue-600 dark:border-brand-blue-500 bg-brand-blue-50/50 dark:bg-brand-blue-950/40 text-brand-blue-900 dark:text-brand-blue-200'
                  : 'border-brand-border dark:border-slate-700 bg-white dark:bg-slate-800 text-brand-text-secondary dark:text-slate-300'
              } ${selectedCategory?.allowedDelivery === 'PICKUP_ONLY' ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              Pickup &amp; Diantar Kurir
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMethod('PICKUP_ONLY')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                deliveryMethod === 'PICKUP_ONLY'
                  ? 'border-brand-blue-600 dark:border-brand-blue-500 bg-brand-blue-50/50 dark:bg-brand-blue-950/40 text-brand-blue-900 dark:text-brand-blue-200'
                  : 'border-brand-border dark:border-slate-700 bg-white dark:bg-slate-800 text-brand-text-secondary dark:text-slate-300'
              }`}
            >
              Pickup Mandiri Saja
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
            Lokasi Titik Temu / Kos Pickup
          </label>
          <input
            type="text"
            placeholder="Contoh: Depan Gerlam Unpad / Kos Griya Hegarmanah Jatinangor"
            value={pickupLocation}
            onChange={(e) => setPickupLocation(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 text-brand-text-primary dark:text-slate-100 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2 border-t border-brand-border dark:border-slate-800">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={loading}>
            {loading ? 'Mengunggah...' : 'Unggah Barang Sekarang'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
