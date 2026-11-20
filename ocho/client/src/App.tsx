import React, { useState, useEffect } from 'react';
import { Navbar } from './components/ui/Navbar';
import { Footer } from './components/ui/Footer';
import { HomePage } from './pages/HomePage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { AdminPage } from './pages/AdminPage';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';
import { RupiahInput } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import { LogoIcon } from './components/ui/Logo';
import { SellModal } from './components/ui/SellModal';
import { WalletModal } from './components/ui/WalletModal';
import { ItemDetail, OrderItem, createOrder, confirmOrderPayment } from './services/api';
import { formatRupiah } from './utils/format';
import { compressImage } from './utils/image';
import {
  AuthUser,
  getStoredUser,
  getStoredToken,
  loginStudent,
  registerStudent,
  updateUsername,
  fetchCurrentProfile,
  clearAuthSession,
} from './services/auth';
import { Icon } from './components/ui/Icon';

type RouteState =
  | { name: 'home' }
  | { name: 'item-detail'; itemId: string }
  | { name: 'orders' }
  | { name: 'admin' }
  | { name: 'showcase' };

export const App: React.FC = () => {
  // Hash-based routing state
  const [route, setRoute] = useState<RouteState>({ name: 'home' });
  const [navbarSearch, setNavbarSearch] = useState<string>('');

  // Authentication session state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Username customization state
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [usernameUpdating, setUsernameUpdating] = useState(false);

  // Theme state: Light mode is default for all new visitors
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('ocho_theme');
    return saved === 'dark'; // Only dark if user explicitly chose it; defaults to light mode
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ocho_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ocho_theme', 'light');
    }
  }, [isDarkMode]);

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  // Checkout state
  const [checkoutModalItem, setCheckoutModalItem] = useState<{
    item: ItemDetail;
    offerId?: string | null;
    deliveryMethod: 'PICKUP' | 'DELIVERY';
    paymentMethod: 'QRIS' | 'COD';
  } | null>(null);
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutDeliveryDate, setCheckoutDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [createdOrderResult, setCreatedOrderResult] = useState<OrderItem | null>(null);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [checkoutProofUrl, setCheckoutProofUrl] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Showcase state
  const [inputPrice, setInputPrice] = useState<number>(75000);
  const [showcaseDelivery, setShowcaseDelivery] = useState<'PICKUP' | 'DELIVERY'>('DELIVERY');
  const [showcaseFirstOrder, setShowcaseFirstOrder] = useState(true);

  // Parse hash URL into route state
  const parseHash = () => {
    const hash = window.location.hash || '#/';
    if (hash.startsWith('#/items/')) {
      const id = hash.replace('#/items/', '').trim();
      if (id) {
        setRoute({ name: 'item-detail', itemId: id });
        return;
      }
    }
    if (hash === '#/orders') {
      setRoute({ name: 'orders' });
      return;
    }
    if (hash === '#/admin') {
      setRoute({ name: 'admin' });
      return;
    }
    if (hash === '#/showcase') {
      setRoute({ name: 'showcase' });
      return;
    }
    setRoute({ name: 'home' });
  };

  useEffect(() => {
    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  // Sync current user on load if token present
  useEffect(() => {
    if (getStoredToken()) {
      fetchCurrentProfile().then((u) => {
        if (u) {
          setCurrentUser(u);
          if (u.phone) setCheckoutPhone(u.phone);
        }
      });
    }
  }, []);

  const navigateTo = (path: string) => {
    window.location.hash = path;
  };

  const handleSearchSubmit = () => {
    if (route.name !== 'home') {
      navigateTo('#/');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === 'LOGIN') {
        const res = await loginStudent({
          email: authEmail,
          password: authPassword,
        });
        setCurrentUser(res.data.user);
        setIsLoginModalOpen(false);
      } else {
        const res = await registerStudent({
          email: authEmail,
          password: authPassword,
          name: authName,
          phone: authPhone,
          username: authUsername.trim() || undefined,
        });
        setCurrentUser(res.data.user);
        setIsLoginModalOpen(false);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Terjadi kesalahan autentikasi');
    } finally {
      setAuthLoading(false);
    }
  };

  const openEditUsername = () => {
    setNewUsernameInput(currentUser?.username || '');
    setUsernameError(null);
    setUsernameSuccess(null);
    setIsUsernameModalOpen(true);
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setUsernameSuccess(null);
    setUsernameUpdating(true);
    try {
      const updatedUser = await updateUsername(newUsernameInput);
      setCurrentUser(updatedUser);
      setUsernameSuccess('Username berhasil diperbarui!');
      setTimeout(() => {
        setIsUsernameModalOpen(false);
        setUsernameSuccess(null);
      }, 1200);
    } catch (err: any) {
      setUsernameError(err.message || 'Gagal memperbarui username.');
    } finally {
      setUsernameUpdating(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    navigateTo('#/');
  };

  const handleCheckoutConfirm = async () => {
    if (!checkoutModalItem) return;

    if (checkoutModalItem.deliveryMethod === 'DELIVERY') {
      if (!checkoutAddress.trim()) {
        alert('Alamat pengantaran (nama kos / gedung) wajib diisi.');
        return;
      }
      if (!checkoutDeliveryDate.trim()) {
        alert('Tanggal pengantaran wajib dipilih (maksimal 3 hari dari sekarang).');
        return;
      }
    }

    setCheckoutLoading(true);
    try {
      const order = await createOrder({
        itemId: checkoutModalItem.item.id,
        deliveryMethod: checkoutModalItem.deliveryMethod,
        paymentMethod: checkoutModalItem.paymentMethod,
        deliveryAddress: checkoutAddress.trim() || null,
        deliveryDate: checkoutModalItem.deliveryMethod === 'DELIVERY' ? checkoutDeliveryDate : null,
        buyerPhone: checkoutPhone.trim() || currentUser?.phone || '081234567890',
        notes: checkoutNotes.trim() || null,
        offerId: checkoutModalItem.offerId || null,
      });

      setCreatedOrderResult(order);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses pesanan.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const compressed = await compressImage(file);
      setCheckoutProofUrl(compressed);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses gambar screenshot bukti bayar');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleConfirmPaymentFromCheckout = async () => {
    if (!createdOrderResult) return;
    if (!checkoutProofUrl) {
      alert('Wajib mengunggah screenshot bukti transfer pembayaran QRIS sebelum konfirmasi.');
      return;
    }
    setConfirmingPay(true);
    try {
      await confirmOrderPayment(createdOrderResult.id, checkoutProofUrl);
      alert('Pembayaran QRIS dan bukti transfer berhasil dikonfirmasi! Pesananmu kini berstatus PAID.');
      setCreatedOrderResult(null);
      setCheckoutModalItem(null);
      setCheckoutProofUrl(null);
      navigateTo('#/orders');
    } catch (err: any) {
      alert(err.message || 'Gagal mengonfirmasi pembayaran.');
    } finally {
      setConfirmingPay(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-surface dark:bg-slate-950 font-sans text-brand-text-primary dark:text-slate-100 flex flex-col transition-colors">
      {/* 1. Global Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onEditUsernameClick={openEditUsername}
        onLoginClick={() => {
          setAuthError(null);
          setIsLoginModalOpen(true);
        }}
        onLogoutClick={handleLogout}
        onOrdersClick={() => navigateTo('#/orders')}
        onWalletClick={() => setIsWalletModalOpen(true)}
        onAdminClick={() => navigateTo('#/admin')}
        onSellClick={() => {
          if (!currentUser) {
            setAuthError('Silakan masuk terlebih dahulu dengan email Unpad untuk menjual barang.');
            setIsLoginModalOpen(true);
          } else {
            setIsSellModalOpen(true);
          }
        }}
        onLogoClick={() => navigateTo('#/')}
        searchQuery={navbarSearch}
        onSearchChange={setNavbarSearch}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* 2. Main Content Routing */}
      <main className="flex-1">
        {route.name === 'home' && (
          <HomePage
            onSelectItem={(itemId) => navigateTo(`#/items/${itemId}`)}
            initialSearch={navbarSearch}
            onSearchChange={setNavbarSearch}
          />
        )}

        {route.name === 'item-detail' && (
          <ItemDetailPage
            itemId={route.itemId}
            onBack={() => navigateTo('#/')}
            currentUserId={currentUser?.id}
            onRequireLogin={() => {
              setAuthError('Silakan masuk dengan akun mahasiswa Unpad untuk mengajukan tawaran nego.');
              setIsLoginModalOpen(true);
            }}
            onCheckoutClick={(item, deliveryMethod, paymentMethod) => {
              if (!currentUser) {
                setAuthError('Silakan masuk dengan akun mahasiswa Unpad untuk membeli barang.');
                setIsLoginModalOpen(true);
                return;
              }
              setCreatedOrderResult(null);
              setCheckoutModalItem({ item, deliveryMethod, paymentMethod });
            }}
          />
        )}

        {route.name === 'orders' && (
          <OrdersPage
            onBackToHome={() => navigateTo('#/')}
            onViewItem={(id) => navigateTo(`#/items/${id}`)}
            onCheckoutOffer={(item, offerId, offerPrice) => {
              setCreatedOrderResult(null);
              setCheckoutModalItem({
                item: {
                  ...item,
                  priceRupiah: offerPrice,
                },
                offerId,
                deliveryMethod: item.allowedDeliveryMethod === 'PICKUP_ONLY' ? 'PICKUP' : 'DELIVERY',
                paymentMethod: 'QRIS',
              });
            }}
          />
        )}

        {route.name === 'admin' && (
          <AdminPage onBackToHome={() => navigateTo('#/')} />
        )}

        {route.name === 'showcase' && (
          <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => navigateTo('#/')}>
                &larr; Kembali ke Marketplace
              </Button>
              <Badge variant="info">Component Showcase</Badge>
            </div>

            {/* Stage 1 Announcement Header */}
            <section className="bg-gradient-to-r from-brand-blue-600 via-brand-purple to-brand-blue-700 rounded-3xl p-8 text-white shadow-soft relative overflow-hidden">
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-semibold text-brand-blue-100 border border-white/20">
                  <Icon name="Sparkle" size={16} className="text-amber-300" />
                  <span>Sistem &amp; Arsitektur Ocho Unpad</span>
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight leading-tight">
                  Ocho Design System &amp; Transparansi Keuangan
                </h1>
                <p className="text-sm md:text-base text-brand-blue-100 leading-relaxed">
                  Semua transaksi preloved dihitung dengan komisi platform 20% ditanggung penjual dan bebas biaya tersembunyi bagi pembeli.
                </p>
              </div>
              <div className="absolute right-6 -bottom-8 opacity-10 pointer-events-none select-none hidden lg:block">
                <LogoIcon size={260} />
              </div>
            </section>

            {/* Financial Calculator Demonstration */}
            <section className="bg-white rounded-3xl border border-brand-border p-8 shadow-card space-y-6">
              <div className="border-b border-brand-border/60 pb-4">
                <h2 className="font-display text-xl font-bold text-brand-text-primary flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-emerald-500 rounded-full"></span>
                  Kalkulator Finansial Transparan Ocho
                </h2>
                <p className="text-xs text-brand-text-secondary mt-1">
                  Membuktikan aturan bisnis komisi 20% ditanggung penjual dan ongkos kirim flat Rp 3.000.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <RupiahInput
                    label="Harga Barang Preloved"
                    value={inputPrice}
                    onChange={(val) => setInputPrice(val)}
                    helperText="Ubah angka untuk menguji simulasi pembagian dana secara live."
                  />

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-brand-text-primary">Metode Pengiriman:</label>
                    <div className="flex gap-2">
                      <Button
                        variant={showcaseDelivery === 'PICKUP' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setShowcaseDelivery('PICKUP')}
                      >
                        Pickup Gratis
                      </Button>
                      <Button
                        variant={showcaseDelivery === 'DELIVERY' ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setShowcaseDelivery('DELIVERY')}
                      >
                        Antar Tim Ocho (Rp 3.000)
                      </Button>
                    </div>
                  </div>

                  {showcaseDelivery === 'DELIVERY' && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-brand-text-primary">
                      <input
                        type="checkbox"
                        checked={showcaseFirstOrder}
                        onChange={(e) => setShowcaseFirstOrder(e.target.checked)}
                        className="rounded text-brand-blue-600 focus:ring-brand-blue-500"
                      />
                      <span>Simulasikan Pesanan Pertama Pembeli (Gratis Ongkir)</span>
                    </label>
                  )}
                </div>

                <div className="bg-brand-surface p-5 rounded-2xl border border-brand-border space-y-3 text-xs">
                  <div className="flex justify-between text-brand-text-secondary">
                    <span>Harga Barang:</span>
                    <span className="font-bold text-brand-text-primary">{formatRupiah(inputPrice)}</span>
                  </div>
                  <div className="flex justify-between text-brand-text-secondary">
                    <span>Komisi 20% (Ditanggung Penjual):</span>
                    <span className="font-bold text-red-600">- {formatRupiah(Math.round(inputPrice * 0.20))}</span>
                  </div>
                  <div className="flex justify-between text-brand-text-secondary">
                    <span>Ongkir Tim Ocho (Ditanggung Pembeli):</span>
                    <span className="font-bold text-brand-text-primary">
                      {showcaseDelivery === 'PICKUP' ? 'Rp 0' : showcaseFirstOrder ? 'Gratis (Rp 0)' : 'Rp 3.000'}
                    </span>
                  </div>
                  <div className="border-t border-brand-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      <span>Penjual Menerima:</span>
                      <span>{formatRupiah(Math.max(0, inputPrice - Math.round(inputPrice * 0.20)))}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-brand-blue-dark bg-blue-50 p-2.5 rounded-xl border border-blue-200">
                      <span>Pembeli Membayar:</span>
                      <span>
                        {formatRupiah(inputPrice + (showcaseDelivery === 'DELIVERY' && !showcaseFirstOrder ? 3000 : 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* 3. Global Footer */}
      <Footer onShowcaseClick={() => navigateTo('#/showcase')} />

      {/* 4. Login & Register Modal */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        title={authMode === 'LOGIN' ? 'Masuk Akun Mahasiswa Unpad' : 'Daftar Akun Mahasiswa Baru'}
        description="Gunakan email resmi @mail.unpad.ac.id untuk akses jual-beli eksklusif kampus."
      >
        <div className="space-y-4 py-2">
          {authError && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
              <Icon name="WarningCircle" size={16} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="flex bg-brand-surface dark:bg-slate-800 p-1 rounded-xl border border-brand-border dark:border-slate-700">
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                authMode === 'LOGIN' ? 'bg-white dark:bg-slate-700 shadow-xs text-brand-blue-600 dark:text-brand-blue-400' : 'text-brand-text-secondary dark:text-slate-400'
              }`}
              onClick={() => {
                setAuthMode('LOGIN');
                setAuthError(null);
              }}
            >
              Masuk
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                authMode === 'REGISTER' ? 'bg-white dark:bg-slate-700 shadow-xs text-brand-blue-600 dark:text-brand-blue-400' : 'text-brand-text-secondary dark:text-slate-400'
              }`}
              onClick={() => {
                setAuthMode('REGISTER');
                setAuthError(null);
              }}
            >
              Daftar Baru
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {authMode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
                  Nama Lengkap Mahasiswa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rian Pratama"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>
            )}

            {authMode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
                  Username Toko / Profil (Publik)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary dark:text-slate-400 text-xs font-bold">@</span>
                  <input
                    type="text"
                    placeholder="nama_unik (opsional, default dari email)"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <p className="text-[10px] text-brand-text-secondary dark:text-slate-400 mt-1">
                  Nama asli Anda aman & tidak dipublikasikan ke pembeli. Dilarang unsur SARA, rasisme, atau kata kasar.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
                Email Kampus Unpad
              </label>
              <input
                type="email"
                required
                placeholder="nama@mail.unpad.ac.id"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              <p className="text-[10px] text-brand-text-secondary dark:text-slate-400 mt-1">
                Wajib domain <strong className="text-brand-blue-600 dark:text-brand-blue-400 font-semibold">@mail.unpad.ac.id</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="Minimal 8 karakter"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>

            {authMode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="08123456789"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                />
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={authLoading}
                className="w-full justify-center text-xs py-2.5"
              >
                {authLoading
                  ? 'Memproses...'
                  : authMode === 'LOGIN'
                  ? 'Masuk ke Ocho'
                  : 'Daftar & Verifikasi Mahasiswa'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Ubah Username Modal */}
      <Modal
        isOpen={isUsernameModalOpen}
        onClose={() => {
          setIsUsernameModalOpen(false);
          setUsernameError(null);
          setUsernameSuccess(null);
        }}
        title="Ubah Username Toko & Profil"
        description="Username ini yang akan dilihat oleh mahasiswa lain di Ocho (nama asli Anda disembunyikan demi privasi)."
      >
        <form onSubmit={handleUpdateUsername} className="space-y-4 py-2">
          {usernameError && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs p-3 rounded-xl flex items-start gap-2">
              <Icon name="WarningCircle" size={16} className="shrink-0 mt-0.5" />
              <span>{usernameError}</span>
            </div>
          )}

          {usernameSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs p-3 rounded-xl flex items-start gap-2">
              <Icon name="CheckCircle" size={16} className="shrink-0 mt-0.5" />
              <span>{usernameSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 mb-1">
              Username Baru
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-secondary dark:text-slate-400 text-xs font-bold">@</span>
              <input
                type="text"
                required
                placeholder="anak_unpad / lapak_jatinangor"
                value={newUsernameInput}
                onChange={(e) => setNewUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                className="w-full pl-7 pr-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100"
              />
            </div>
            <p className="text-[11px] text-brand-text-secondary dark:text-slate-400 mt-1.5 leading-relaxed">
              Aturan: 3-20 karakter, huruf kecil, angka, titik (.) atau garis bawah (_). Dilarang keras mengandung unsur <strong>SARA, rasisme, ujaran kebencian, kata kasar, atau impersonasi admin</strong>.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsUsernameModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={usernameUpdating || !newUsernameInput.trim()}
            >
              {usernameUpdating ? 'Menyimpan...' : 'Simpan Username'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. Sell Modal (Fully Functional) */}
      <SellModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        onSuccess={() => {
          alert('Selamat! Barang preloved kamu berhasil tayang di marketplace Ocho.');
          navigateTo('#/');
        }}
      />

      {/* 6. Wallet Modal (Fully Functional) */}
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

      {/* 7. Checkout Flow Modal */}
      {checkoutModalItem && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (!createdOrderResult) setCheckoutModalItem(null);
          }}
          title={createdOrderResult ? 'Pesanan Berhasil Dibuat!' : 'Konfirmasi Pesanan'}
          description={
            createdOrderResult
              ? `No. Pesanan: #${createdOrderResult.orderNumber}`
              : `Beli preloved dari sesama mahasiswa Unpad terverifikasi.`
          }
        >
          {createdOrderResult ? (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <Icon name="CheckCircle" size={24} weight="fill" />
              </div>

              {createdOrderResult.paymentMethod === 'QRIS' ? (
                <>
                  <div className="space-y-1">
                    <h4 className="font-display font-bold text-base text-brand-text-primary dark:text-slate-100">
                      Scan QRIS Resmi untuk Menyelesaikan Pembayaran
                    </h4>
                    <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-sm mx-auto">
                      Barang di-reserve selama <strong className="text-brand-orange font-bold">30 menit</strong>.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-brand-border dark:border-slate-700 inline-block mx-auto text-center space-y-2 max-w-[280px] shadow-sm">
                    <img
                      src="/qris.jpg"
                      alt="QRIS Ocho Resmi"
                      className="w-full h-auto rounded-xl object-contain mx-auto border border-brand-border/40 dark:border-slate-700"
                    />
                    <div className="text-[11px] font-mono font-bold text-brand-blue-700 dark:text-brand-blue-300 bg-brand-surface dark:bg-slate-900 py-1 px-2 rounded-lg">
                      NMID: ID1026493553733
                    </div>
                    <p className="text-[11px] text-brand-text-secondary dark:text-slate-400 leading-tight">
                      Bisa di-scan dari GoPay, BCA, Mandiri, BNI, BRI, OVO, atau Dana.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-brand-text-secondary dark:text-slate-400">Total Tagihan:</p>
                    <p className="font-display font-black text-2xl text-brand-orange tabular-nums">
                      {formatRupiah(createdOrderResult.buyerTotalRupiah)}
                    </p>
                  </div>

                  {/* Upload Bukti Pembayaran Form */}
                  <div className="bg-brand-surface dark:bg-slate-800/60 p-3.5 rounded-2xl border border-brand-border dark:border-slate-700 space-y-2.5 text-left">
                    <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 flex items-center gap-1.5">
                      <Icon name="UploadSimple" size={16} className="text-brand-blue-600 dark:text-brand-blue-400" />
                      <span>Unggah Screenshot Bukti Transfer *</span>
                    </label>
                    <p className="text-[11px] text-brand-text-secondary dark:text-slate-400 leading-snug">
                      Wajib melampirkan screenshot atau foto resi pembayaran QRIS sebagai bukti konfirmasi transaksi.
                    </p>

                    {checkoutProofUrl ? (
                      <div className="space-y-2">
                        <div className="relative border border-brand-border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 p-2">
                          <img
                            src={checkoutProofUrl}
                            alt="Bukti Transfer"
                            className="max-h-48 w-auto mx-auto rounded-lg object-contain"
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <Icon name="CheckCircle" size={16} weight="fill" />
                            Bukti transfer berhasil dipilih
                          </span>
                          <button
                            type="button"
                            onClick={() => setCheckoutProofUrl(null)}
                            className="text-red-600 dark:text-red-400 hover:underline font-bold text-[11px]"
                          >
                            Ganti Screenshot
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-brand-blue-300 dark:border-slate-700 hover:border-brand-blue-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800/80 transition-colors">
                        <Icon name="UploadSimple" size={24} className="text-brand-blue-600 dark:text-brand-blue-400 mb-1" />
                        <span className="text-xs font-bold text-brand-blue-700 dark:text-brand-blue-300">
                          {uploadingProof ? 'Memproses gambar...' : 'Klik untuk Unggah Screenshot Bukti'}
                        </span>
                        <span className="text-[10px] text-brand-text-secondary dark:text-slate-400 mt-0.5">
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

                  <div className="flex justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCheckoutModalItem(null);
                        setCreatedOrderResult(null);
                        setCheckoutProofUrl(null);
                        navigateTo('#/orders');
                      }}
                    >
                      Buka Pesanan Saya
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={confirmingPay || !checkoutProofUrl || uploadingProof}
                      onClick={handleConfirmPaymentFromCheckout}
                    >
                      {confirmingPay ? 'Memverifikasi...' : 'Saya Sudah Membayar & Kirim Bukti'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-display font-bold text-base text-brand-text-primary dark:text-slate-100">
                    Pesanan COD Berhasil Dipesan!
                  </h4>
                  <p className="text-xs text-brand-text-secondary dark:text-slate-400 max-w-sm mx-auto">
                    Kurir Ocho akan menghubungi WhatsApp <strong className="text-brand-text-primary dark:text-slate-200">{createdOrderResult.buyerPhone}</strong> dan mengantarkan barang ke <strong className="text-brand-text-primary dark:text-slate-200">{createdOrderResult.deliveryAddress}</strong>.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setCheckoutModalItem(null);
                      setCreatedOrderResult(null);
                      navigateTo('#/orders');
                    }}
                  >
                    Buka Pesanan Saya
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Item Summary */}
              <div className="flex items-center gap-3 p-3 bg-brand-surface dark:bg-slate-800/60 rounded-xl border border-brand-border dark:border-slate-700">
                <img
                  src={checkoutModalItem.item.photos[0]?.url}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0 border border-brand-border dark:border-slate-700"
                />
                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-display font-bold text-sm text-brand-text-primary dark:text-slate-100 truncate">
                    {checkoutModalItem.item.title}
                  </h4>
                  <p className="text-xs text-brand-text-secondary dark:text-slate-400">
                    Penjual:{' '}
                    {checkoutModalItem.item.seller.username
                      ? `@${checkoutModalItem.item.seller.username}`
                      : `@${checkoutModalItem.item.seller.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
                  </p>
                  <p className="text-xs font-black text-brand-orange">
                    {formatRupiah(checkoutModalItem.item.priceRupiah)}
                  </p>
                </div>
              </div>

              {/* Delivery Details Form */}
              {checkoutModalItem.deliveryMethod === 'DELIVERY' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 flex items-center gap-1 mb-1">
                      <Icon name="Truck" size={16} className="text-brand-blue-600 dark:text-brand-blue-400" />
                      <span>Alamat Pengantaran (Nama Kos / Gedung) *</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Kos Pondok Melati Kamar 12, Jl. Sayang No. 45"
                      value={checkoutAddress}
                      onChange={(e) => setCheckoutAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 flex items-center gap-1 mb-1">
                      <Icon name="Calendar" size={16} className="text-brand-blue-600 dark:text-brand-blue-400" />
                      <span>Tanggal Pengantaran (Pilihan Hari: Maksimal 3 Hari) *</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      max={new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)}
                      value={checkoutDeliveryDate}
                      onChange={(e) => setCheckoutDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100"
                    />
                    <p className="text-[10px] text-brand-text-secondary dark:text-slate-400 mt-1">
                      Pilih tanggal pengantaran antara hari ini hingga maksimal 3 hari ke depan.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 flex items-center gap-1 mb-1">
                    <Icon name="Phone" size={16} className="text-brand-blue-600 dark:text-brand-blue-400" />
                    <span>No. WhatsApp Pembeli *</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="08123456789"
                    value={checkoutPhone}
                    onChange={(e) => setCheckoutPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text-primary dark:text-slate-200 flex items-center gap-1 mb-1">
                    <Icon name="FileText" size={16} className="text-brand-blue-600 dark:text-brand-blue-400" />
                    <span>Catatan untuk Penjual / Kurir</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Titip ibu kos / ketemu di gerlam"
                    value={checkoutNotes}
                    onChange={(e) => setCheckoutNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-brand-surface dark:bg-slate-800 border border-brand-border dark:border-slate-700 rounded-xl focus:border-brand-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none text-brand-text-primary dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Price Calculation */}
              <div className="space-y-2 text-xs bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-brand-border/60 dark:border-slate-700">
                <div className="flex justify-between text-brand-text-secondary dark:text-slate-400">
                  <span>Metode Pengambilan:</span>
                  <span className="font-bold text-brand-text-primary dark:text-slate-200">
                    {checkoutModalItem.deliveryMethod === 'PICKUP' ? 'Pickup Kampus (Gratis)' : 'Diantar Tim Ocho'}
                  </span>
                </div>
                <div className="flex justify-between text-brand-text-secondary dark:text-slate-400">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold text-brand-text-primary dark:text-slate-200">
                    {checkoutModalItem.paymentMethod === 'QRIS' ? 'QRIS Instan' : 'COD (Bayar Tunai saat Kurir Tiba)'}
                  </span>
                </div>
                <div className="border-t border-brand-border/60 dark:border-slate-700 pt-2 flex justify-between text-sm font-bold text-brand-text-primary dark:text-slate-100">
                  <span>Total Tagihan:</span>
                  <span className="text-brand-orange font-black text-base">
                    {formatRupiah(
                      checkoutModalItem.item.priceRupiah +
                        (checkoutModalItem.deliveryMethod === 'DELIVERY' ? 3000 : 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-brand-border dark:border-slate-800">
                <Button variant="ghost" size="sm" onClick={() => setCheckoutModalItem(null)}>
                  Batal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={checkoutLoading}
                  onClick={handleCheckoutConfirm}
                >
                  {checkoutLoading ? 'Memproses...' : 'Konfirmasi Pesanan'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
