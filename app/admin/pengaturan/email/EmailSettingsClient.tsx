"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import {
  HiOutlineArrowPath,
  HiOutlineEnvelope,
  HiOutlinePaperAirplane,
  HiOutlineCheckCircle,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

type EmailSettings = {
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  fromName?: string;
  fromEmail?: string;
};

export function ClientComponent() {
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [formData, setFormData] = useState({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    fromName: "",
    fromEmail: "",
  });

  const { isLoading: loading, mutate: fetchSettings } = useApi<EmailSettings>(
    "/api/admin/settings/email",
    {
      onError: (err) => {
        clientLogger.error("Error fetching email settings:", err);
      },
      onSuccess: (data) => {
        if (!data) return;
        setFormData({
          smtpHost: data.smtpHost || "",
          smtpPort: data.smtpPort || "587",
          smtpUser: data.smtpUser || "",
          smtpPass: data.smtpPass || "",
          fromName: data.fromName || "",
          fromEmail: data.fromEmail || "",
        });
      },
    },
  );

  const getResponseMessage = async (
    response: Response,
    fallback: string,
  ): Promise<string> => {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
    return fallback;
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setSaving(true);

      const dataToSend = {
        ...formData,
        smtpPass: formData.smtpPass.trim().replace(/\s+/g, ""),
      };

      const res = await fetch("/api/admin/settings/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) {
        setError(await getResponseMessage(res, "Gagal menyimpan pengaturan"));
        return;
      }

      setSuccess("Pengaturan email berhasil disimpan");
      setTimeout(() => setSuccess(null), 3000);
      await fetchSettings();
    } catch (err) {
      clientLogger.error("Error saving settings:", err);
      setError("Terjadi kesalahan saat menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setError(null);
    setSuccess(null);

    try {
      setTesting(true);
      const response = await fetch("/api/admin/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          testEmail: testEmail.trim() || formData.fromEmail,
        }),
      });

      const message = await getResponseMessage(
        response,
        "Gagal mengirim email percobaan",
      );

      if (response.ok) {
        setSuccess(message || "Email percobaan berhasil dikirim");
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      setError(`Tes gagal: ${message}`);
    } catch (error) {
      clientLogger.error("Error testing email:", error);
      setError("Kesalahan saat testing email");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HiOutlineEnvelope className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Email Configuration
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Configure SMTP settings for sending invoices and notifications
        </p>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-6"
        >
          {/* SMTP Host */}
          <div>
            <label
              htmlFor="smtp-host"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              SMTP Host *
            </label>
            <input
              id="smtp-host"
              type="text"
              value={formData.smtpHost}
              onChange={(e) =>
                setFormData({ ...formData, smtpHost: e.target.value })
              }
              placeholder="smtp.gmail.com"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Example: smtp.gmail.com, smtp.office365.com, mail.yourdomain.com
            </p>
          </div>

          {/* SMTP Port */}
          <div>
            <label
              htmlFor="smtp-port"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              SMTP Port *
            </label>
            <select
              id="smtp-port"
              value={formData.smtpPort}
              onChange={(e) =>
                setFormData({ ...formData, smtpPort: e.target.value })
              }
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="587">587 (TLS - Recommended)</option>
              <option value="465">465 (SSL)</option>
              <option value="25">25 (No encryption)</option>
            </select>
          </div>

          {/* SMTP User */}
          <div>
            <label
              htmlFor="smtp-user"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              SMTP Username / Email *
            </label>
            <input
              id="smtp-user"
              type="email"
              value={formData.smtpUser}
              onChange={(e) =>
                setFormData({ ...formData, smtpUser: e.target.value })
              }
              placeholder="your-email@gmail.com"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* SMTP Password */}
          <div>
            <label
              htmlFor="smtp-pass"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              SMTP Password *
            </label>
            <input
              id="smtp-pass"
              type="password"
              value={formData.smtpPass}
              onChange={(e) =>
                setFormData({ ...formData, smtpPass: e.target.value })
              }
              placeholder="Enter SMTP password or App Password"
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              For Gmail, use App Password (Settings → Security → 2-Step
              Verification → App passwords). Password should be 16 characters
              without spaces.
              {formData.smtpPass && (
                <span className="text-blue-600 dark:text-blue-400 ml-2 font-mono">
                  Length: {formData.smtpPass.length} chars
                </span>
              )}
            </p>
          </div>

          {/* From Name */}
          <div>
            <label
              htmlFor="from-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              From Name *
            </label>
            <input
              id="from-name"
              type="text"
              value={formData.fromName}
              onChange={(e) =>
                setFormData({ ...formData, fromName: e.target.value })
              }
              placeholder="NetManager ISP"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* From Email */}
          <div>
            <label
              htmlFor="from-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              From Email *
            </label>
            <input
              id="from-email"
              type="email"
              value={formData.fromEmail}
              onChange={(e) =>
                setFormData({ ...formData, fromEmail: e.target.value })
              }
              placeholder="billing@netmanager.com"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This email will appear as sender in invoice emails
            </p>
          </div>

          <div>
            <label
              htmlFor="test-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Test Email
            </label>
            <input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={formData.fromEmail || "test@example.com"}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Kosongkan untuk mengirim email percobaan ke From Email.
            </p>
          </div>

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
              {success}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              onClick={handleTest}
              disabled={
                testing ||
                !formData.smtpHost ||
                !formData.smtpUser ||
                (!testEmail && !formData.fromEmail)
              }
              variant="secondary"
            >
              {testing ? (
                <>
                  <HiOutlineArrowPath className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <HiOutlinePaperAirplane className="w-4 h-4" />
                  Send Test Email
                </>
              )}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              variant="default"
              className="flex-1"
            >
              {saving ? (
                <>
                  <HiOutlineArrowPath className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <HiOutlineCheckCircle className="w-4 h-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Help Section */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 dark:text-blue-400 mb-2 flex items-center gap-2">
            <HiOutlineEnvelope className="w-5 h-5" /> Gmail Setup Guide:
          </h3>
          <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
            <li>Go to Google Account → Security</li>
            <li>Enable 2-Step Verification</li>
            <li>Go to App Passwords section</li>
            <li>Select &quot;Mail&quot; and generate password</li>
            <li>Use generated password as SMTP Password</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
