import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ShieldCheck, Phone, Mail, Loader2, CheckCircle2,
  IndianRupee, Lock, Star, Sparkles
} from "lucide-react";
import { apiFetch } from "@/lib/api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentModalProps {
  matchId: number;
  lawyerName: string;
  caseTitle: string;
  budgetRange?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function PaymentModal({ matchId, lawyerName, caseTitle, budgetRange, onClose, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<"idle" | "loading" | "paying" | "success" | "error">("idle");
  const [order, setOrder] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [revealedContact, setRevealedContact] = useState<{ name: string; phone: string | null; email: string | null } | null>(null);

  useEffect(() => {
    initPayment();
  }, []);

  async function initPayment() {
    setStep("loading");
    try {
      const data = await apiFetch(`/matches/${matchId}/create-payment`, { method: "POST" });
      if (data.already_paid) {
        setStep("success");
        return;
      }
      setOrder(data);
      setStep("idle");
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not initialise payment. Please try again.");
      setStep("error");
    }
  }

  async function handlePay() {
    if (!order) return;

    if (order.demo_mode) {
      await completeDemoPayment();
      return;
    }

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setErrorMsg("Could not load Razorpay. Check your internet connection.");
      setStep("error");
      return;
    }

    setStep("paying");
    const options = {
      key: order.key,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "LitigaForge AI",
      description: `Lawyer Connection Fee — ${lawyerName}`,
      order_id: order.id,
      prefill: {},
      notes: { match_id: String(matchId) },
      theme: { color: "#1a2744" },
      modal: { ondismiss: () => setStep("idle") },
      handler: async (response: any) => {
        try {
          const result = await apiFetch(`/matches/${matchId}/verify-payment`, {
            method: "POST",
            body: JSON.stringify({
              razorpay_order_id:  response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          setRevealedContact(result.lawyer_contact);
          setStep("success");
          onSuccess();
        } catch {
          setErrorMsg("Payment went through but verification failed. Contact support with your payment ID.");
          setStep("error");
        }
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", () => {
      setErrorMsg("Payment failed. Please try a different payment method.");
      setStep("error");
    });
    rzp.open();
  }

  async function completeDemoPayment() {
    setStep("paying");
    try {
      const result = await apiFetch(`/matches/${matchId}/verify-payment`, {
        method: "POST",
        body: JSON.stringify({ demo_token: order.demo_token }),
      });
      setRevealedContact(result.lawyer_contact);
      setStep("success");
      onSuccess();
    } catch (e: any) {
      setErrorMsg(e?.message || "Demo payment failed.");
      setStep("error");
    }
  }

  const amountPaise = order?.amount ?? 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          {step !== "success" && (
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#F5F3FF" }}>
                  <Lock className="w-4 h-4 text-violet-600" />
                </div>
                <span className="font-bold text-gray-900 text-sm">Connect with Lawyer</span>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="px-5 pb-5">
            {step === "loading" && (
              <div className="py-10 flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
                <p className="text-sm text-gray-500">Calculating connection fee…</p>
              </div>
            )}

            {(step === "idle" || step === "paying") && order && (
              <>
                <div className="rounded-xl p-3.5 mb-4" style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                  <p className="text-[11px] text-gray-400 mb-0.5">Connecting you with</p>
                  <p className="text-sm font-bold text-gray-900">{lawyerName}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">{caseTitle}</p>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">What you unlock</p>
                  {[
                    { icon: <Phone className="w-3.5 h-3.5" />, text: "Lawyer's direct phone number" },
                    { icon: <Mail className="w-3.5 h-3.5" />, text: "Lawyer's email address" },
                    { icon: <Star className="w-3.5 h-3.5" />, text: "AI-matched for your case — one-time fee" },
                    { icon: <ShieldCheck className="w-3.5 h-3.5" />, text: "Platform guarantee on verified advocates" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-[12px] text-gray-600">
                      <span className="text-emerald-500">{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-3.5 mb-4 flex items-center justify-between" style={{ background: "#1a2744" }}>
                  <div>
                    <p className="text-[10px] text-blue-200 mb-0.5">Platform Connection Fee</p>
                    {budgetRange && (
                      <p className="text-[10px] text-blue-300">Based on budget: {budgetRange}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{formatPaise(amountPaise)}</p>
                    <p className="text-[10px] text-blue-300">one-time · inc. GST</p>
                  </div>
                </div>

                {order.demo_mode && (
                  <div className="rounded-lg px-3 py-2 mb-3 text-[11px] text-amber-700 flex items-center gap-2" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span><strong>Demo mode</strong> — no real payment. Add Razorpay keys to go live.</span>
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={step === "paying"}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1a2744 0%, #2563EB 100%)" }}
                >
                  {step === "paying"
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                    : order.demo_mode
                      ? <><Sparkles className="w-4 h-4" /> Simulate Payment (Demo)</>
                      : <><IndianRupee className="w-4 h-4" /> Pay {formatPaise(amountPaise)} · Connect Now</>
                  }
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-2">Secured by Razorpay · PCI-DSS compliant</p>
              </>
            )}

            {step === "success" && (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "#ECFDF5" }}>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Lawyer Connected!</h3>
                  <p className="text-sm text-gray-500 mt-1">Contact details are now available on your matches page.</p>
                </div>
                {revealedContact && (
                  <div className="rounded-xl p-4 text-left space-y-2" style={{ background: "#F8FAFC", border: "1px solid #BBF7D0" }}>
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">Contact Details</p>
                    {revealedContact.phone && (
                      <a href={`tel:${revealedContact.phone}`} className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-emerald-600 transition-colors">
                        <Phone className="w-4 h-4 text-emerald-500" /> {revealedContact.phone}
                      </a>
                    )}
                    {revealedContact.email && (
                      <a href={`mailto:${revealedContact.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                        <Mail className="w-4 h-4 text-blue-400" /> {revealedContact.email}
                      </a>
                    )}
                    {!revealedContact.phone && !revealedContact.email && (
                      <p className="text-[12px] text-gray-500">The advocate will contact you via the platform chat.</p>
                    )}
                  </div>
                )}
                <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ background: "#1a2744" }}>
                  Done
                </button>
              </div>
            )}

            {step === "error" && (
              <div className="py-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto bg-red-50">
                  <X className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Something went wrong</h3>
                  <p className="text-sm text-gray-500 mt-1">{errorMsg}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={initPayment} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ background: "#1a2744" }}>
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
