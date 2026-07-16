-- ESB parity: aggregate on SUBTOTAL (ESB's own recap basis — the dashboard
-- "Cancelled or Void Sales" tile equals the report's subtotal sum), and store
-- the report's grand total per synced day so every sync self-validates.

alter table fraud_orders add column if not exists subtotal numeric not null default 0;

alter table fraud_sync add column if not exists expected_subtotal numeric not null default 0;
alter table fraud_sync add column if not exists synced_subtotal numeric not null default 0;
