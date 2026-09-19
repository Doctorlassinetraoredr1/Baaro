import { useState, useEffect, useRef } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { supabase } from '../../supabaseClient.js'; // ✅ Importation du client centralisé

const RESEND_DELAY = 30; // secondes

function guessDefaultCountry() {
  try {
    const locale = navigator.language || navigator.languages?.[0] || '';
    const region = locale.split('-')[1];
    if (region && region.length === 2) return region.toUpperCase();
  } catch {
    // ignore
  }
  return 'ML'; // Mali par défaut
}

export default function PhoneAuth({ onAuthSuccess }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState(''); // E.164 (+223...)
  const [defaultCountry] = useState(guessDefaultCountry);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  function startCooldown() {
    setResendCooldown(RESEND_DELAY);
    timerRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function sendOtp(e) {
    e?.preventDefault();
    setError('');

    if (!phone || !isValidPhoneNumber(phone)) {
      setError('Numéro de téléphone invalide pour ce pays.');
      return;
    }

    setLoading(true);

    // Déclenche le Hook "Send SMS" dans Supabase (notre Edge Function + Téléphone Android)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
    });
    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setStep('otp');
    startCooldown();
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError('');

    if (otp.trim().length < 4) {
      setError('Code invalide.');
      return;
    }

    setLoading(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: otp.trim(),
      type: 'sms',
    });

    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      return;
    }

    // Utilisation stricte de la convention `id`
    const userId = data.user.id;
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: userId,
        phone,
        created_at: new Date().toISOString(),
      });
    }

    setLoading(false);
    onAuthSuccess?.(data.user);
  }

  async function resendOtp() {
    if (resendCooldown > 0) return;
    await sendOtp();
  }

  return (
    <div className="w-full space-y-4">
      {step === 'phone' && (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Numéro de téléphone
            </label>
            <PhoneInput
              international
              defaultCountry={defaultCountry}
              value={phone}
              onChange={setPhone}
              placeholder="Entre ton numéro"
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus-within:border-amber-500/50 transition-colors phone-input-baaro"
            />
          </div>

          {error && (
            <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-teal-400 text-slate-950 shadow-lg disabled:opacity-50 hover:opacity-95 transition-all active:scale-[0.98]"
          >
            {loading ? 'Envoi...' : 'Recevoir le code'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verifyOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">
              Code reçu par SMS (<span className="text-amber-400">{phone}</span>)
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-slate-800 bg-slate-950/60 text-slate-100 rounded-xl px-4 py-3 tracking-widest text-center text-lg font-mono outline-none focus:border-amber-500/50 transition-colors"
              required
              autoFocus
            />
          </div>

          {error && (
            <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-teal-400 text-slate-950 shadow-lg disabled:opacity-50 hover:opacity-95 transition-all active:scale-[0.98]"
          >
            {loading ? 'Vérification...' : 'Valider'}
          </button>

          <div className="flex justify-between items-center text-xs pt-1">
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="text-slate-400 hover:text-slate-200 transition-colors underline"
            >
              Changer de numéro
            </button>
            <button
              type="button"
              onClick={resendOtp}
              disabled={resendCooldown > 0}
              className="text-amber-400 hover:text-amber-300 disabled:text-slate-600 transition-colors font-medium"
            >
              {resendCooldown > 0
                ? `Renvoyer (${resendCooldown}s)`
                : 'Renvoyer le code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
