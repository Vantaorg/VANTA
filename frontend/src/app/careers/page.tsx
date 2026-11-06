import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowLeft, Zap, Heart, Shield, Users, Globe, Coffee } from "lucide-react";

export const metadata: Metadata = {
  title: "Careers | VANTA",
  description: "Join VANTA and help shape the future of social connection. Explore open positions and build your career with us.",
  openGraph: {
    title: "Careers | VANTA",
    description: "Join VANTA and help shape the future of social connection.",
    type: "website",
    siteName: "VANTA",
  },
};

const benefits = [
  { icon: Zap, title: "Cutting-Edge Tech", desc: "Work with modern tech stack — Next.js, React, TypeScript, Node.js, and more." },
  { icon: Globe, title: "Remote-First", desc: "Work from anywhere in the world. We trust our team to do their best work." },
  { icon: Heart, title: "Health & Wellness", desc: "Comprehensive health coverage, mental health support, and wellness programs." },
  { icon: Shield, title: "Equity & Ownership", desc: "Every full-time team member gets equity. We build this together." },
  { icon: Users, title: "Amazing Team", desc: "Work with passionate, talented people who care about what they build." },
  { icon: Coffee, title: "Top-Tier Equipment", desc: "Get the gear you need to do your best work — from day one." },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-white">
      {/* Header */}
      <div className="relative border-b border-white/[0.06]">
        
        <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-10 ">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#d6a83f]/10 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-lg font-semibold tracking-[0.18em]">VANTA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">Join the Team</h1>
          <p className="text-white/55 text-sm sm:text-base max-w-2xl">Help us build the future of social connection. We're looking for passionate people who want to make a difference.</p>
        </div>
      </div>

      {/* Mission */}
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">
        <div className="text-center mb-10">
          <h2 className="text-xl font-semibold text-white mb-3">Our Mission</h2>
          <p className="text-white/60 leading-relaxed max-w-2xl mx-auto">
            At VANTA, we're building a platform where authentic human connection thrives. 
            We believe technology should bring people closer, not push them apart. 
            Join us in creating something meaningful.
          </p>
        </div>

        {/* Benefits */}
        <h2 className="text-xl font-semibold text-white text-center mb-5">Why Work at VANTA</h2>
        <div className="grid gap-3 sm:grid-cols-2 mb-10">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="rounded-xl border border-white/[0.07] bg-[var(--surface)] p-4">
              <div className="w-10 h-10 rounded-xl bg-[#d6a83f]/10 flex items-center justify-center mb-4">
                <benefit.icon size={18} className="text-white" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{benefit.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{benefit.desc}</p>
            </div>
          ))}
        </div>

        {/* Open Positions */}
        <div className="rounded-xl border border-white/[0.07] bg-[var(--surface)] p-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-white/40" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Open Positions Right Now</h3>
          <p className="text-sm text-white/40 max-w-md mx-auto mb-6">
            We're not actively hiring at the moment, but we're always looking for talented people. 
            Send your resume and we'll keep you in mind for future opportunities.
          </p>
          <a
            href="mailto:careers@vanta.app"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#d6a83f] text-[#17130a] font-semibold text-sm hover:bg-[#e0bb4f] transition-colors"
          >
            Send Resume
          </a>
          <p className="text-xs text-white/20 mt-3">careers@vanta.app</p>
        </div>
      </div>
    </div>
  );
}