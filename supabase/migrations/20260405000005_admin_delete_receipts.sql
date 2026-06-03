-- Allow admins to delete receipts and line items.
-- Line items cascade on receipt delete, but need their own DELETE policy for RLS.

create policy "Admins can delete receipts"
  on public.receipts for delete
  using (public.is_admin());

create policy "Admins can delete line items"
  on public.line_items for delete
  using (public.is_admin());
