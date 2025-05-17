"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUserProfile } = useAuth(); // Assuming refreshUserProfile exists to update credits
  const [message, setMessage] = useState("Processing your payment...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // Wait for user context to load
      setMessage("Verifying user session...");
      return;
    }

    const paymentToken = searchParams.get("payment_token"); // As per XPay docs
    const paymentStatus = searchParams.get("status"); // As per XPay docs / our setup

    const verifyPayment = async () => {
      if (paymentStatus === "success" && paymentToken) {
        setMessage("Payment successful! Verifying and updating your credits...");
        try {
          const response = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentToken: paymentToken,
              userId: user.id,
              creditsToAward: 3 // $20 for 3 credits
            }),
          });

          const result = await response.json();

          if (response.ok && result.success) {
            setMessage("Credits successfully added! Redirecting...");
            if (refreshUserProfile) {
              await refreshUserProfile(); // Refresh user profile to get updated credits
            }
          } else {
            setMessage(result.error || "Failed to verify payment or update credits. Please contact support.");
          }
        } catch (error) {
          console.error("Verification API error:", error);
          setMessage("An error occurred while verifying your payment. Please contact support.");
        }
      } else if (paymentStatus === "failed") {
        setMessage("Payment failed or was cancelled. Redirecting...");
      } else if (!paymentToken && paymentStatus !== "cancelled") { // "cancelled" might be another status from XPay
        setMessage("Invalid payment callback. Missing payment token. Redirecting...");
      } else {
        // Potentially handle other statuses like "cancelled" if XPay sends them
        setMessage("Payment status unclear or payment was cancelled. Redirecting...");
      }

      setIsLoading(false);
      // Redirect back to home page after a delay so user can see message
      setTimeout(() => {
        router.replace("/"); // Use replace to avoid callback URL in history
      }, 3000);
    };

    verifyPayment();

  }, [user, searchParams, router, refreshUserProfile]);

  return (
    <main data-lk-theme="default" className="h-full flex flex-col items-center justify-center bg-[var(--lk-bg)]">
      <div className="text-center p-8 rounded-lg shadow-xl bg-white max-w-md">
        <h1 className="text-2xl font-semibold mb-4">Payment Status</h1>
        {isLoading && (
          <div className="flex justify-center items-center my-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}
        <p className="text-lg">{message}</p>
        {!isLoading && (
          <button
            onClick={() => router.replace("/")}
            className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Go to Homepage
          </button>
        )}
      </div>
    </main>
  );
}

// Supense wrapper for useSearchParams
export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div>Loading payment details...</div>}>
      <PaymentCallbackContent />
    </Suspense>
  );
} 