import { redirect } from 'next/navigation';

type ChatConversationPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function ChatConversationPage({ params }: ChatConversationPageProps) {
  const { conversationId } = await params;
  redirect(`/chat?conversation=${encodeURIComponent(conversationId)}`);
}
