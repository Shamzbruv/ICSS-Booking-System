/** Idempotent database fixes retained on fresh installs and later deploys. */
const MAINTENANCE_SQL = Object.freeze([
    "CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON public.tenants (plan_id)",
    "CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON public.services (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON public.bookings (service_id)",
    "CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id)",
    "CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON public.order_items (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id)",
    "CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments (booking_id)",
    "CREATE INDEX IF NOT EXISTS idx_unavailable_slots_tenant_id ON public.unavailable_slots (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_design_inquiries_tenant_id ON public.design_inquiries (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_deposit_sessions_tenant_id ON public.deposit_sessions (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_id ON public.calendar_connections (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_pending_signups_theme_id ON public.pending_signups (theme_id)",
    "CREATE INDEX IF NOT EXISTS idx_tenants_theme_id ON public.tenants (theme_id)",
    "CREATE INDEX IF NOT EXISTS idx_custom_theme_requests_tenant_id ON public.custom_theme_requests (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_tenant_slug_history_tenant_id ON public.tenant_slug_history (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_ledger_transactions_tenant_id ON public.ledger_transactions (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction_id ON public.journal_entries (transaction_id)",
    "CREATE INDEX IF NOT EXISTS idx_journal_entries_account_id ON public.journal_entries (account_id)",
    "CREATE INDEX IF NOT EXISTS idx_booking_payments_booking_id ON public.booking_payments (booking_id)",
    "CREATE INDEX IF NOT EXISTS idx_booking_payments_tenant_id ON public.booking_payments (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON public.audit_log (actor_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target_user_id ON public.impersonation_sessions (target_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_partner_agreements_owner_user_id ON public.partner_agreements (owner_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_partner_agreements_partner_user_id ON public.partner_agreements (partner_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_support_jobs_submitted_by ON public.support_jobs (submitted_by)",
    "CREATE INDEX IF NOT EXISTS idx_support_jobs_assigned_to ON public.support_jobs (assigned_to)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_oauth_states_tenant_id ON public.calendar_oauth_states (tenant_id)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_oauth_states_user_id ON public.calendar_oauth_states (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_bookings_created_by_user_id ON public.bookings (created_by_user_id)"
]);

const FUNCTION_HARDENING_SQL = `DO $$ BEGIN
    IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    END IF;
    IF to_regprocedure('pgboss.create_queue(text,json)') IS NOT NULL THEN
        ALTER FUNCTION pgboss.create_queue(text,json) SET search_path=pg_catalog,pgboss;
    END IF;
    IF to_regprocedure('pgboss.delete_queue(text)') IS NOT NULL THEN
        ALTER FUNCTION pgboss.delete_queue(text) SET search_path=pg_catalog,pgboss;
    END IF;
END $$`;

async function runDatabaseMaintenance(client) {
    for (const sql of MAINTENANCE_SQL) await client.query(sql);
    // Supabase roles and its automatic RLS helper exist only on Supabase.
    const result = await client.query("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') AS supabase");
    if (result.rows[0]?.supabase) await client.query(FUNCTION_HARDENING_SQL);
}

module.exports = { runDatabaseMaintenance, MAINTENANCE_SQL, FUNCTION_HARDENING_SQL };
