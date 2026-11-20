import React from 'react';
import { ItemSummary } from '../../services/api';
import { formatRupiah, formatRelativeTime } from '../../utils/format';
import { Badge } from './Badge';
import { Card, CardContent } from './Card';
import { Icon } from './Icon';

export interface ProductCardProps {
  item: ItemSummary;
  onClick?: (item: ItemSummary) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ item, onClick }) => {
  const primaryPhoto =
    item.photos.find((p) => p.isPrimary)?.url ||
    item.photos[0]?.url ||
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f2f4f5"/><text x="200" y="150" fill="%23888" font-size="14" text-anchor="middle">Foto Tidak Tersedia</text></svg>';

  const isPickupOnly = item.allowedDeliveryMethod === 'PICKUP_ONLY';
  const isSold = item.status === 'SOLD';
  const isReserved = item.status === 'RESERVED';

  const sellerHandle = item.seller.username
    ? `@${item.seller.username}`
    : `@${item.seller.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const sellerInitial = (item.seller.username || item.seller.name).charAt(0).toUpperCase();

  return (
    <Card
      hoverable={!isSold}
      onClick={() => onClick && onClick(item)}
      className={`group flex flex-col h-full bg-white dark:bg-slate-900 border border-brand-border dark:border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer ${
        isSold ? 'opacity-70 bg-gray-50 dark:bg-slate-900/60' : 'hover:border-brand-blue-300 dark:hover:border-slate-700 hover:shadow-card'
      }`}
    >
      {/* Photo Container */}
      <div className="relative aspect-4/3 w-full bg-brand-surface dark:bg-slate-800 overflow-hidden">
        <img
          src={primaryPhoto}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
          <Badge variant="category">{item.category.name}</Badge>
          {item.size && (
            <span className="text-[11px] font-bold bg-white/90 dark:bg-slate-900/90 text-brand-text-primary dark:text-slate-100 px-2 py-0.5 rounded-md shadow-xs border border-brand-border/60 dark:border-slate-700">
              Size {item.size}
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 z-10">
          {isPickupOnly ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-500/90 text-white px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs">
              <Icon name="Package" size={16} />
              <span>Khusus Pickup</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-brand-blue-600/90 text-white px-2 py-0.5 rounded-md shadow-xs backdrop-blur-xs">
              <Icon name="Truck" size={16} />
              <span>Bisa Antar</span>
            </span>
          )}
        </div>

        {/* Sold / Reserved Overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-20">
            <span className="bg-red-600 text-white font-display text-sm font-bold tracking-wider uppercase px-4 py-1.5 rounded-lg shadow-md">
              Terjual
            </span>
          </div>
        )}

        {isReserved && (
          <div className="absolute inset-0 bg-brand-blue-900/40 backdrop-blur-2xs flex items-center justify-center z-20">
            <span className="bg-amber-500 text-white font-display text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-lg shadow-md">
              Sedang Dipesan
            </span>
          </div>
        )}
      </div>

      {/* Content Container */}
      <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Condition & Upload Time */}
          <div className="flex items-center justify-between text-[11px] text-brand-text-secondary dark:text-slate-400">
            <span className="font-semibold text-brand-blue-dark dark:text-brand-blue-300 bg-brand-blue-50 dark:bg-brand-blue-950/60 px-2 py-0.5 rounded">
              {item.condition}
            </span>
            <span>{formatRelativeTime(item.createdAt)}</span>
          </div>

          {/* Title */}
          <h3 className="font-display font-bold text-sm text-brand-text-primary dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-brand-blue-600 dark:group-hover:text-brand-blue-400 transition-colors">
            {item.title}
          </h3>
        </div>

        {/* Pricing & Location */}
        <div className="pt-2 border-t border-brand-border/60 dark:border-slate-800 space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] text-brand-text-secondary dark:text-slate-400">
                  {item.isNegotiable ? 'Harga Awal' : 'Harga Pas'}
                </span>
                {item.isNegotiable && (
                  <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                    Bisa Nego
                  </span>
                )}
              </div>
              <p className="font-display text-lg font-black text-brand-orange leading-none tabular-nums">
                {formatRupiah(item.priceRupiah)}
              </p>
            </div>

            {item.pickupLocation && (
              <span
                className="text-[11px] text-brand-text-secondary dark:text-slate-400 flex items-center gap-1 max-w-[130px] truncate"
                title={item.pickupLocation}
              >
                <Icon name="MapPin" size={16} className="text-brand-blue-500 shrink-0" />
                <span className="truncate">{item.pickupLocation}</span>
              </span>
            )}
          </div>

          {/* Verified Seller Tag (Custom Student Handle) */}
          <div className="flex items-center justify-between text-[11px] text-brand-text-secondary dark:text-slate-400 pt-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-5 h-5 rounded-full bg-brand-blue-100 dark:bg-brand-blue-950 text-brand-blue-700 dark:text-brand-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                {sellerInitial}
              </span>
              <span className="truncate font-medium text-brand-text-primary dark:text-slate-200">{sellerHandle}</span>
            </div>

            {item.seller.isVerified && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded shrink-0 border border-emerald-200 dark:border-emerald-800">
                <Icon name="ShieldCheck" size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>Terverifikasi</span>
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
