'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';

const guidelines = [
  {
    icon: HeartHandshake,
    title: 'Treat people with respect',
    description: 'Be welcoming. Do not bully, threaten, harass, or target people with abuse. Respect boundaries and differences, even when you disagree.',
  },
  {
    icon: ShieldCheck,
    title: 'Keep content safe',
    description: 'Do not post unlawful, exploitative, violent, or otherwise harmful content. Never share intimate imagery without consent or content that endangers another person.',
  },
  {
    icon: LockKeyhole,
    title: 'Protect privacy',
    description: 'Do not publish someone else’s private information, credentials, private messages, or identifying details without permission. Do not impersonate people or mislead others about who you are.',
  },
  {
    icon: MessageCircle,
    title: 'Communicate honestly',
    description: 'Avoid spam, scams, deceptive links, coordinated manipulation, and repeated unwanted messages. Do not use VANTA to defraud or exploit others.',
  },
  {
    icon: Eye,
    title: 'Share responsibly',
    description: 'Only upload content you have the right to share. Give context where needed, respect copyright, and consider the impact your posts, Reels, comments, and live streams may have on others.',
  },
  {
    icon: Users,
    title: 'Make communities welcoming',
    description: 'Groups, channels, comments, and live rooms should be places people can participate safely. Do not encourage violence, hateful abuse, or targeted harassment.',
  },
];

export default function CommunityGuidelinesPage() {
  const [showReporting, setShowReporting] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#07070d] text-white">
      <PageHeader sticky bleed title="Community Guidelines" back="/settings/about" />
      <main className="w-full px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <div className="w-full border-b border-white/[0.08] pb-6">
          <p className="text-sm leading-relaxed text-white/55">What’s allowed on VANTA</p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/45">
            VANTA is for connecting, creating, and sharing. These guidelines explain the behavior we expect so people can take part without abuse, deception, or harm.
          </p>
        </div>

        <section className="w-full divide-y divide-white/[0.07]" aria-label="Community standards">
          {guidelines.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="grid w-full gap-3 py-5 sm:grid-cols-[minmax(180px,0.34fr)_minmax(0,1fr)] sm:gap-8">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-[#d6b45a]">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <h2 className="pt-1.5 text-sm font-semibold leading-6 text-white">{index + 1}. {item.title}</h2>
                </div>
                <p className="text-sm leading-7 text-white/60">{item.description}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-6 w-full border-t border-white/[0.08] py-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-white/55" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-white">Content that crosses the line</h2>
              <p className="mt-2 text-sm leading-7 text-white/60">
                Content or behavior that violates these standards may be removed, limited, or reported for review. Serious or repeated violations can lead to account restrictions or suspension, consistent with VANTA’s Terms of Service and applicable law.
              </p>
              <button type="button" onClick={() => setShowReporting((value) => !value)} aria-expanded={showReporting} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[#d6b45a] transition hover:text-white">
                <CheckCircle2 size={16} />
                {showReporting ? 'Hide reporting guidance' : 'How to report a concern'}
              </button>
              {showReporting && (
                <p className="mt-2 text-sm leading-7 text-white/55">
                  Use the report option available on the relevant post, Reel, profile, message, or live room when it is provided. Include enough context for the team to review the issue, and contact support at{' '}
                  <a href="mailto:vantapp74@gmail.com" className="underline decoration-white/30 underline-offset-4 hover:text-white">vantapp74@gmail.com</a>{' '}
                  if you need further assistance.
                </p>
              )}
            </div>
          </div>
        </section>

        <p className="border-t border-white/[0.08] pt-5 text-xs leading-6 text-white/35">
          These guidelines work alongside the <a href="/terms" className="underline decoration-white/25 underline-offset-4 hover:text-white">Terms of Service</a> and <a href="/privacy" className="underline decoration-white/25 underline-offset-4 hover:text-white">Privacy Policy</a>.
        </p>
      </main>
    </div>
  );
}
