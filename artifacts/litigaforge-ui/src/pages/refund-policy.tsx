import { SEOHelmet } from "@/components/SEOHelmet";
import { PageShell } from "@/components/PageShell";
import { motion } from "framer-motion";
import { RotateCcw, Shield, Clock, CreditCard, HelpCircle } from "lucide-react";

export default function RefundPolicy() {
  return (
    <PageShell
      title="Refund Policy"
      subtitle="Our commitment to fair and transparent billing"
      icon={<RotateCcw className="w-6 h-6 text-primary" />}
    >
      <SEOHelmet
        title="Refund Policy - LitigaForge AI"
        description="LitigaForge AI refund policy. 7-day no-questions-asked refund for subscription plans."
        canonical="/refund-policy"
      />
      <div className="max-w-3xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">7-Day No-Questions-Asked Refund</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We are confident in our service. If you are not satisfied with your subscription
            for any reason, you can request a full refund within <strong>7 days</strong> of your
            first payment. No questions asked. No forms to fill. Just send us an email.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Refund Timeline</h2>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold">1.</span>
              <span>Refund requests are processed within <strong>48 hours</strong> of receipt.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold">2.</span>
              <span>Refunds are credited back to the original payment method (Razorpay/Stripe).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold">3.</span>
              <span>Depending on your bank, the refund may take <strong>5-10 business days</strong> to reflect in your account.</span>
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Prorated Downgrades</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you downgrade from a paid plan to Free, you keep your current tier benefits
            until the end of your current billing period. No immediate cut-off. You will
            not be charged again until you choose to upgrade.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">How to Request a Refund</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Simply email us with your registered email address and the reason for the refund
            (optional). We will process it promptly.
          </p>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm font-medium text-foreground">support@litigaforge.com</p>
            <p className="text-xs text-muted-foreground mt-1">Subject: Refund Request</p>
          </div>
        </motion.div>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Last updated: June 2026
        </p>
      </div>
    </PageShell>
  );
}
