"use client";

import Link from "next/link";
import { Sparkles, ArrowLeft, Mail, HelpCircle, Briefcase, Send } from "lucide-react";
import { SocialLinks } from "@/components/ui/SocialLinks";
import {
  VANTA_SOCIAL_LINKS,
  VANTA_SUPPORT_EMAIL,
  VANTA_GENERAL_EMAIL,
} from "@/lib/socialLinks";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      {/* Header */}
      <div className="relative border-b border-white/[0.06]">
        
        <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-10 ">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d6a83f] to-[#c8c8cc] flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-lg font-semibold tracking-[0.18em]">VANTA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">Contact Us</h1>
          <p className="text-white/55 text-sm sm:text-base max-w-xl">We&apos;d love to hear from you. Reach out to our team for any questions or support.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
        <div className="grid gap-8">
          {/* Contact Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Get in Touch</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[var(--surface)] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <HelpCircle size={16} className="text-[#c8c8cc]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Support</h3>
                    <a href={`mailto:${VANTA_SUPPORT_EMAIL}`} className="text-sm text-white/40 hover:text-white transition-colors">
                      {VANTA_SUPPORT_EMAIL}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[#d6a83f]/10 border border-[#d6a83f]/20 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-[#d6a83f]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">General Inquiries</h3>
                    <a href={`mailto:${VANTA_GENERAL_EMAIL}`} className="text-sm text-white/40 hover:text-white transition-colors">
                      {VANTA_GENERAL_EMAIL}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[var(--surface)] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <Briefcase size={16} className="text-[#c8c8cc]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Business Enquiries</h3>
                    <a href={`mailto:${VANTA_GENERAL_EMAIL}`} className="text-sm text-white/40 hover:text-white transition-colors">
                      {VANTA_GENERAL_EMAIL}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Social links — single source of truth (shared constants) */}
            <div className="pt-5 border-t border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white mb-3">Follow Us</h3>
              <div className="flex items-center gap-3">
                <SocialLinks iconSize="lg" variant="hero" />
              </div>
              <p className="mt-4 text-xs text-white/30">
                {VANTA_SOCIAL_LINKS.map((link) => link.label).join(" \u00b7 ")}
              </p>
            </div>
          </div>

          {/* Contact channels */}
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--surface)] border border-white/[0.07] p-4">
              <h2 className="text-base font-semibold text-white mb-2">Send us a message</h2>
              <p className="text-sm text-white/40 leading-relaxed mb-5">
                Prefer to write to us directly? Compose an email to our support address
                and our team will reply within a day.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`mailto:${VANTA_SUPPORT_EMAIL}?subject=VANTA%20Support`}
                  className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#d6a83f] text-[#17130a] font-semibold text-sm px-5 h-10 transition-colors hover:bg-[#e0bb4f]"
                >
                  Email Support <Send size={14} className="transition-transform group-hover:translate-x-0.5" />
                </a>
                {VANTA_SOCIAL_LINKS.map((link) => (
                  <a
                    key={link.platform}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--surface-secondary)] border border-white/[0.07] text-sm text-white/65 hover:text-white hover:bg-[var(--surface-active)] px-4 h-10 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
