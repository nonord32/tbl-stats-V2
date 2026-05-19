// src/app/admin/cards/page.tsx
import { CardsAdminClient } from './CardsAdminClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin · Weekly Cards' };

export default function AdminCardsPage() {
  return <CardsAdminClient />;
}
