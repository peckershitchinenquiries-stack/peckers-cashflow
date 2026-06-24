-- =================================================================
-- YoY EPOS data: channel orders + customer metrics
-- Run in Supabase SQL Editor (vm-analytics project)
-- =================================================================

-- Add missing columns to vm_yoy_stevenage (safe — ignored if already exist)
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS click_collect   integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS kiosk            integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS till_eat_in      integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS till_takeaway    integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS own_delivery     integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS deliveroo        integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS just_eat         integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS uber_eats        integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS total_orders     integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS new_customers    integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS return_customers integer;
ALTER TABLE vm_yoy_stevenage ADD COLUMN IF NOT EXISTS total_customers  integer;

-- Add missing columns to vm_yoy_hitchin (safe — ignored if already exist)
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS click_collect   integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS kiosk            integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS till_eat_in      integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS till_takeaway    integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS own_delivery     integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS deliveroo        integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS just_eat         integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS uber_eats        integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS total_orders     integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS new_customers    integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS return_customers integer;
ALTER TABLE vm_yoy_hitchin ADD COLUMN IF NOT EXISTS total_customers  integer;

-- Add missing columns to vm_yoy_both_stores (safe — ignored if already exist)
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS click_collect   integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS kiosk            integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS till_eat_in      integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS till_takeaway    integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS own_delivery     integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS deliveroo        integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS just_eat         integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS uber_eats        integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS total_orders     integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS new_customers    integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS return_customers integer;
ALTER TABLE vm_yoy_both_stores ADD COLUMN IF NOT EXISTS total_customers  integer;

-- ---------------------------------------------------------------
-- vm_yoy_stevenage: insert/update 108 weeks of EPOS data
-- ---------------------------------------------------------------
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-04-29', 132, 610, 54, 233, 184, 0, 0, 0, 1213, 677, 249, 926)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-06', 108, 548, 37, 210, 118, 0, 92, 0, 1113, 503, 271, 774)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-13', 70, 423, 53, 222, 82, 0, 156, 0, 1006, 329, 246, 575)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-20', 57, 408, 61, 178, 85, 0, 151, 0, 940, 309, 241, 550)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-27', 57, 452, 50, 207, 92, 16, 142, 0, 1016, 320, 281, 601)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-03', 68, 377, 58, 181, 76, 44, 159, 0, 963, 257, 264, 521)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-10', 66, 332, 48, 149, 82, 39, 130, 0, 846, 240, 240, 480)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-17', 55, 367, 44, 195, 60, 35, 137, 0, 893, 228, 254, 482)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-24', 52, 345, 34, 194, 61, 49, 160, 0, 895, 201, 257, 458)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-01', 47, 308, 28, 146, 71, 56, 186, 0, 842, 180, 246, 426)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-08', 44, 345, 37, 146, 73, 50, 159, 0, 854, 200, 262, 462)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-15', 39, 333, 32, 156, 64, 55, 144, 0, 823, 194, 242, 436)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-22', 56, 288, 30, 162, 49, 43, 149, 0, 777, 161, 232, 393)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-29', 48, 330, 20, 190, 60, 43, 138, 0, 829, 185, 253, 438)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-05', 46, 315, 36, 175, 58, 51, 142, 0, 823, 187, 232, 419)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-12', 37, 318, 29, 187, 49, 41, 156, 0, 817, 158, 246, 404)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-19', 65, 348, 17, 161, 38, 50, 168, 0, 847, 193, 258, 451)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-26', 45, 307, 19, 190, 53, 53, 143, 0, 810, 160, 245, 405)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-02', 39, 317, 21, 169, 62, 46, 133, 0, 787, 168, 250, 418)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-09', 49, 314, 37, 187, 63, 54, 95, 0, 799, 169, 257, 426)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-16', 43, 292, 20, 149, 51, 34, 124, 0, 713, 172, 214, 386)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-23', 26, 309, 26, 148, 52, 53, 131, 0, 745, 179, 208, 387)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-30', 44, 324, 35, 154, 60, 44, 127, 0, 788, 165, 263, 428)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-07', 41, 314, 39, 180, 46, 48, 113, 18, 799, 160, 241, 401)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-14', 47, 283, 35, 177, 56, 45, 102, 46, 791, 150, 236, 386)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-21', 35, 299, 45, 186, 48, 50, 136, 46, 845, 148, 234, 382)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-28', 43, 319, 32, 171, 52, 35, 170, 54, 876, 157, 257, 414)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-04', 38, 315, 26, 170, 42, 55, 151, 38, 835, 152, 243, 395)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-11', 38, 304, 33, 165, 52, 41, 150, 37, 820, 148, 246, 394)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-18', 30, 274, 23, 181, 43, 48, 145, 38, 782, 123, 224, 347)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-25', 30, 269, 22, 160, 57, 51, 158, 50, 797, 115, 241, 356)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-02', 34, 305, 27, 201, 52, 43, 172, 47, 881, 146, 245, 391)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-09', 30, 311, 33, 215, 44, 56, 159, 46, 894, 144, 241, 385)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-16', 37, 295, 30, 177, 50, 45, 163, 44, 841, 143, 239, 382)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-23', 34, 225, 23, 122, 48, 36, 131, 42, 661, 97, 210, 307)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-30', 47, 195, 29, 116, 37, 29, 104, 32, 589, 93, 186, 279)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-06', 32, 271, 34, 113, 40, 44, 129, 29, 692, 123, 220, 343)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-13', 35, 296, 35, 137, 46, 41, 124, 36, 750, 126, 251, 377)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-20', 44, 282, 34, 124, 53, 43, 156, 32, 768, 128, 251, 379)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-27', 39, 323, 33, 150, 49, 42, 173, 43, 852, 142, 269, 411)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-03', 38, 299, 40, 160, 49, 41, 180, 38, 845, 114, 272, 386)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-10', 37, 313, 38, 179, 43, 41, 138, 37, 826, 125, 268, 393)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-17', 34, 299, 35, 148, 31, 55, 184, 37, 823, 115, 249, 364)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-24', 28, 352, 43, 143, 45, 47, 150, 37, 845, 160, 265, 425)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-03', 36, 351, 41, 181, 49, 51, 149, 33, 891, 150, 286, 436)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-10', 39, 328, 37, 171, 32, 51, 156, 48, 862, 144, 255, 399)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-17', 34, 317, 42, 187, 37, 41, 137, 53, 848, 134, 254, 388)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-24', 38, 382, 38, 181, 32, 49, 144, 39, 903, 159, 293, 452)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-31', 31, 337, 53, 179, 41, 51, 136, 33, 861, 154, 255, 409)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-07', 36, 330, 31, 184, 32, 44, 137, 48, 842, 132, 266, 398)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-14', 39, 305, 60, 157, 41, 35, 114, 51, 802, 146, 239, 385)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-21', 42, 314, 43, 199, 34, 49, 133, 57, 871, 129, 261, 390)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-28', 32, 372, 47, 166, 38, 41, 129, 66, 891, 157, 285, 442)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-05', 31, 318, 50, 162, 50, 32, 111, 58, 812, 128, 271, 399)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-12', 40, 355, 55, 166, 30, 40, 117, 52, 855, 132, 293, 425)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-19', 38, 365, 34, 164, 30, 41, 120, 63, 855, 140, 293, 433)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-26', 30, 385, 52, 205, 36, 40, 134, 59, 941, 145, 306, 451)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-02', 38, 344, 36, 191, 44, 33, 158, 67, 911, 143, 283, 426)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-09', 41, 390, 46, 172, 45, 31, 138, 56, 919, 164, 312, 476)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-16', 33, 336, 38, 182, 33, 27, 148, 54, 851, 136, 266, 402)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-23', 37, 314, 44, 159, 54, 38, 138, 52, 836, 107, 298, 405)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-30', 40, 352, 37, 176, 43, 42, 132, 59, 881, 136, 299, 435)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-07', 33, 335, 43, 185, 37, 41, 123, 49, 846, 135, 270, 405)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-14', 29, 312, 37, 171, 51, 38, 116, 55, 809, 124, 268, 392)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-21', 42, 331, 57, 149, 51, 45, 102, 55, 832, 141, 283, 424)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-28', 44, 344, 39, 180, 50, 41, 152, 52, 902, 154, 284, 438)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-04', 30, 340, 43, 168, 38, 38, 112, 39, 808, 141, 267, 408)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-11', 33, 328, 41, 163, 49, 46, 131, 53, 844, 142, 268, 410)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-18', 34, 331, 36, 200, 44, 35, 128, 57, 865, 143, 266, 409)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-25', 30, 316, 40, 152, 56, 44, 153, 69, 860, 135, 267, 402)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-01', 43, 343, 38, 164, 52, 45, 112, 85, 882, 142, 296, 438)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-08', 35, 341, 39, 188, 48, 50, 89, 62, 852, 158, 266, 424)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-15', 29, 274, 45, 154, 38, 43, 106, 55, 744, 118, 223, 341)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-22', 39, 336, 40, 189, 50, 39, 125, 66, 884, 149, 276, 425)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-29', 41, 382, 40, 172, 58, 44, 135, 72, 944, 168, 313, 481)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-06', 39, 356, 42, 155, 57, 45, 103, 85, 882, 175, 277, 452)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-13', 45, 335, 62, 154, 51, 45, 126, 74, 892, 154, 277, 431)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-20', 35, 300, 57, 179, 47, 46, 109, 77, 850, 126, 256, 382)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-27', 34, 317, 60, 158, 49, 58, 132, 89, 897, 136, 264, 400)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-03', 30, 316, 31, 166, 42, 45, 104, 74, 808, 113, 275, 388)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-10', 34, 309, 44, 188, 50, 50, 127, 83, 885, 143, 250, 393)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-17', 37, 266, 41, 181, 53, 51, 113, 65, 807, 120, 236, 356)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-24', 38, 329, 41, 165, 64, 40, 115, 78, 870, 153, 278, 431)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-01', 40, 286, 32, 188, 45, 59, 133, 73, 856, 113, 258, 371)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-08', 33, 245, 27, 209, 52, 47, 120, 55, 788, 103, 227, 330)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-15', 42, 315, 42, 190, 47, 55, 114, 78, 883, 124, 280, 404)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-22', 27, 224, 23, 161, 49, 56, 104, 62, 706, 109, 191, 300)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-29', 33, 269, 30, 137, 54, 44, 87, 67, 721, 106, 250, 356)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-05', 31, 223, 26, 153, 44, 38, 111, 46, 672, 82, 216, 298)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-12', 31, 270, 39, 181, 38, 40, 99, 50, 748, 130, 209, 339)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-19', 38, 317, 39, 162, 50, 44, 102, 52, 804, 131, 274, 405)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-26', 53, 317, 35, 187, 50, 53, 134, 67, 896, 134, 286, 420)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-02', 30, 304, 34, 193, 52, 50, 96, 70, 829, 128, 258, 386)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-09', 34, 289, 38, 183, 48, 51, 123, 58, 824, 103, 268, 371)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-16', 38, 331, 31, 200, 56, 42, 89, 66, 853, 158, 267, 425)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-23', 39, 311, 59, 241, 60, 61, 119, 83, 973, 139, 271, 410)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-02', 36, 319, 37, 206, 64, 38, 115, 70, 885, 123, 296, 419)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-09', 42, 352, 36, 219, 52, 55, 115, 72, 943, 155, 291, 446)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-16', 41, 330, 34, 195, 67, 52, 115, 59, 893, 134, 304, 438)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-23', 42, 368, 42, 206, 74, 57, 113, 79, 981, 158, 326, 484)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-30', 58, 320, 39, 210, 59, 56, 101, 73, 916, 154, 283, 437)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-06', 59, 366, 46, 201, 59, 49, 116, 72, 968, 164, 320, 484)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-13', 48, 394, 48, 334, 64, 56, 113, 70, 1127, 205, 301, 506)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-20', 41, 426, 47, 322, 80, 45, 93, 63, 1117, 221, 326, 547)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-27', 49, 491, 48, 281, 81, 45, 93, 67, 1155, 277, 344, 621)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-04', 41, 567, 32, 286, 78, 44, 84, 59, 1191, 359, 327, 686)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-11', 51, 658, 44, 306, 63, 46, 81, 75, 1324, 466, 306, 772)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_stevenage (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-18', 37, 379, 47, 162, 72, 47, 107, 74, 925, 164, 324, 488)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;

-- ---------------------------------------------------------------
-- vm_yoy_hitchin: insert/update 108 weeks of EPOS data
-- ---------------------------------------------------------------
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-04-29', 58, 280, 34, 223, 86, 18, 158, 55, 912, 127, 297, 424)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-06', 71, 208, 15, 223, 77, 26, 176, 36, 832, 99, 257, 356)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-13', 59, 222, 20, 212, 72, 21, 180, 43, 829, 108, 245, 353)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-20', 52, 218, 21, 192, 70, 27, 212, 35, 827, 111, 229, 340)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-27', 58, 215, 23, 210, 74, 29, 190, 42, 841, 124, 223, 347)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-03', 45, 208, 23, 192, 83, 24, 177, 47, 799, 96, 240, 336)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-10', 66, 200, 17, 186, 82, 18, 192, 47, 808, 100, 248, 348)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-17', 73, 176, 12, 206, 85, 28, 167, 50, 797, 94, 240, 334)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-24', 61, 194, 10, 200, 96, 27, 178, 51, 817, 117, 234, 351)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-01', 49, 233, 21, 191, 77, 31, 184, 49, 835, 108, 251, 359)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-08', 63, 196, 16, 215, 88, 29, 145, 57, 809, 104, 243, 347)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-15', 46, 211, 14, 195, 72, 27, 160, 44, 769, 108, 221, 329)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-22', 52, 224, 12, 217, 76, 35, 154, 47, 817, 113, 239, 352)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-29', 56, 199, 11, 207, 71, 28, 180, 37, 789, 110, 216, 326)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-05', 51, 204, 11, 174, 71, 19, 127, 46, 703, 110, 216, 326)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-12', 52, 207, 6, 160, 74, 27, 155, 49, 730, 96, 237, 333)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-19', 48, 168, 5, 166, 65, 25, 138, 59, 674, 82, 199, 281)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-26', 66, 194, 8, 170, 74, 29, 156, 59, 756, 84, 250, 334)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-02', 51, 181, 16, 174, 53, 24, 128, 45, 672, 83, 202, 285)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-09', 56, 190, 22, 181, 67, 17, 138, 36, 707, 86, 227, 313)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-16', 62, 231, 21, 198, 52, 14, 139, 47, 764, 104, 241, 345)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-23', 53, 170, 14, 179, 75, 18, 141, 58, 708, 93, 205, 298)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-30', 59, 187, 14, 208, 58, 18, 155, 38, 737, 88, 216, 304)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-07', 48, 203, 22, 186, 61, 17, 131, 54, 722, 99, 213, 312)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-14', 53, 209, 10, 173, 62, 24, 150, 57, 738, 100, 224, 324)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-21', 80, 222, 15, 158, 73, 27, 144, 57, 776, 106, 269, 375)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-28', 56, 216, 15, 186, 64, 29, 153, 48, 767, 80, 256, 336)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-04', 55, 187, 9, 143, 61, 24, 133, 40, 652, 87, 216, 303)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-11', 54, 202, 6, 145, 55, 22, 153, 65, 702, 75, 236, 311)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-18', 53, 177, 10, 153, 55, 27, 132, 74, 681, 91, 194, 285)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-25', 53, 212, 10, 174, 71, 23, 159, 57, 759, 100, 236, 336)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-02', 52, 170, 6, 134, 79, 30, 183, 58, 712, 81, 220, 301)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-09', 48, 173, 7, 151, 65, 41, 161, 46, 692, 88, 198, 286)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-16', 45, 194, 17, 155, 74, 29, 145, 48, 707, 84, 229, 313)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-23', 42, 145, 9, 124, 56, 19, 110, 31, 536, 73, 170, 243)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-30', 44, 114, 7, 94, 48, 16, 82, 36, 441, 67, 139, 206)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-06', 50, 144, 18, 154, 67, 31, 121, 50, 635, 64, 197, 261)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-13', 53, 171, 10, 153, 53, 30, 146, 52, 668, 76, 201, 277)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-20', 61, 152, 19, 147, 68, 32, 134, 50, 663, 74, 207, 281)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-27', 58, 187, 6, 162, 57, 35, 163, 46, 714, 86, 216, 302)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-03', 59, 177, 12, 170, 65, 30, 163, 38, 714, 81, 220, 301)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-10', 50, 145, 13, 156, 55, 43, 132, 59, 653, 75, 175, 250)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-17', 76, 188, 13, 177, 76, 29, 125, 41, 725, 99, 241, 340)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-24', 66, 215, 5, 172, 75, 24, 139, 48, 744, 101, 255, 356)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-03', 61, 184, 2, 182, 66, 30, 146, 64, 735, 95, 216, 311)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-10', 55, 193, 4, 145, 68, 39, 130, 41, 675, 90, 226, 316)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-17', 58, 175, 6, 183, 59, 23, 144, 44, 692, 67, 225, 292)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-24', 56, 192, 6, 168, 68, 34, 124, 44, 692, 99, 217, 316)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-31', 57, 232, 9, 212, 64, 31, 111, 52, 768, 99, 254, 353)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-07', 55, 198, 8, 203, 58, 19, 129, 57, 727, 100, 211, 311)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-14', 50, 198, 11, 178, 46, 33, 121, 60, 697, 82, 212, 294)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-21', 65, 173, 6, 189, 59, 32, 125, 62, 711, 95, 202, 297)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-28', 51, 247, 9, 211, 61, 38, 143, 62, 822, 87, 272, 359)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-05', 45, 221, 7, 190, 76, 30, 130, 45, 744, 106, 236, 342)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-12', 53, 171, 6, 177, 55, 33, 110, 55, 660, 78, 201, 279)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-19', 49, 195, 5, 163, 67, 30, 116, 59, 684, 86, 225, 311)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-26', 48, 217, 6, 168, 70, 38, 128, 58, 733, 106, 229, 335)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-02', 53, 194, 3, 144, 79, 25, 155, 65, 718, 89, 237, 326)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-09', 51, 217, 7, 168, 60, 33, 118, 63, 717, 112, 216, 328)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-16', 59, 219, 8, 181, 59, 42, 137, 73, 778, 96, 241, 337)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-23', 55, 212, 12, 181, 65, 40, 153, 73, 791, 114, 218, 332)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-30', 49, 212, 10, 179, 64, 30, 102, 58, 704, 89, 236, 325)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-07', 49, 208, 15, 188, 70, 28, 114, 56, 728, 94, 233, 327)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-14', 57, 168, 12, 162, 59, 31, 111, 49, 649, 85, 199, 284)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-21', 46, 185, 5, 131, 51, 45, 100, 49, 612, 80, 202, 282)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-28', 55, 206, 8, 168, 58, 37, 129, 61, 722, 68, 251, 319)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-04', 52, 169, 6, 160, 53, 32, 112, 50, 634, 93, 181, 274)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-11', 60, 178, 10, 186, 52, 42, 113, 78, 719, 74, 216, 290)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-18', 43, 188, 8, 176, 61, 39, 105, 66, 686, 79, 213, 292)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-25', 47, 184, 10, 159, 80, 37, 122, 79, 718, 83, 228, 311)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-01', 52, 208, 9, 174, 60, 28, 86, 53, 670, 94, 226, 320)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-08', 54, 177, 9, 164, 60, 36, 76, 53, 629, 73, 218, 291)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-15', 57, 186, 13, 159, 58, 24, 93, 46, 636, 96, 205, 301)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-22', 61, 197, 3, 163, 71, 45, 78, 58, 676, 86, 243, 329)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-29', 57, 178, 7, 149, 58, 37, 100, 71, 657, 83, 210, 293)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-06', 49, 191, 7, 158, 49, 29, 113, 65, 661, 79, 210, 289)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-13', 50, 188, 14, 146, 51, 19, 100, 62, 630, 85, 204, 289)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-20', 41, 180, 7, 156, 55, 25, 103, 51, 618, 68, 208, 276)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-27', 54, 199, 9, 128, 62, 39, 107, 68, 666, 82, 233, 315)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-03', 61, 171, 7, 140, 66, 31, 91, 68, 635, 70, 228, 298)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-10', 48, 151, 4, 142, 76, 31, 97, 53, 602, 63, 212, 275)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-17', 49, 161, 6, 143, 57, 25, 108, 67, 616, 70, 197, 267)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-24', 54, 173, 7, 136, 60, 29, 112, 79, 650, 85, 202, 287)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-01', 54, 181, 5, 120, 61, 30, 92, 74, 617, 84, 212, 296)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-08', 43, 176, 5, 129, 68, 28, 91, 68, 608, 74, 213, 287)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-15', 46, 199, 13, 132, 70, 33, 101, 66, 660, 96, 219, 315)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-22', 28, 89, 1, 131, 45, 14, 78, 49, 435, 42, 120, 162)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-29', 41, 150, 3, 140, 50, 24, 98, 69, 575, 71, 170, 241)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-05', 44, 149, 7, 119, 39, 21, 89, 74, 542, 69, 163, 232)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-12', 36, 158, 6, 121, 57, 31, 70, 61, 540, 75, 176, 251)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-19', 40, 175, 6, 128, 42, 27, 73, 55, 546, 74, 183, 257)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-26', 54, 183, 3, 116, 47, 25, 96, 82, 606, 87, 197, 284)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-02', 50, 178, 4, 151, 50, 41, 88, 79, 641, 75, 203, 278)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-09', 44, 187, 7, 141, 61, 30, 81, 63, 614, 86, 206, 292)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-16', 47, 155, 1, 129, 48, 30, 75, 62, 547, 86, 164, 250)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-23', 50, 165, 6, 154, 65, 32, 85, 68, 625, 70, 210, 280)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-02', 56, 171, 13, 126, 58, 40, 76, 72, 612, 86, 199, 285)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-09', 37, 133, 8, 126, 42, 28, 62, 61, 497, 62, 150, 212)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-16', 61, 177, 3, 145, 67, 26, 78, 64, 621, 84, 221, 305)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-23', 58, 181, 10, 121, 67, 40, 79, 88, 644, 98, 208, 306)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-30', 45, 223, 9, 141, 74, 27, 78, 68, 665, 93, 249, 342)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-06', 62, 193, 18, 150, 58, 36, 89, 79, 685, 88, 225, 313)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-13', 58, 476, 10, 307, 58, 37, 87, 75, 1108, 353, 239, 592)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-20', 51, 579, 13, 260, 79, 31, 70, 66, 1149, 462, 247, 709)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-27', 61, 441, 17, 221, 82, 27, 77, 73, 999, 321, 263, 584)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-04', 48, 405, 10, 189, 75, 41, 64, 73, 905, 283, 245, 528)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-11', 49, 378, 10, 158, 73, 25, 58, 61, 812, 223, 277, 500)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_hitchin (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-18', 51, 224, 12, 154, 91, 36, 67, 69, 704, 90, 276, 366)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;

-- ---------------------------------------------------------------
-- vm_yoy_both_stores: insert/update 108 weeks of EPOS data
-- ---------------------------------------------------------------
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-04-29', 190, 890, 88, 456, 270, 18, 158, 55, 2125, 804, 546, 1350)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-06', 179, 756, 52, 433, 195, 26, 268, 36, 1945, 602, 528, 1130)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-13', 129, 645, 73, 434, 154, 21, 336, 43, 1835, 437, 491, 928)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-20', 109, 626, 82, 370, 155, 27, 363, 35, 1767, 420, 470, 890)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-05-27', 115, 667, 73, 417, 166, 45, 332, 42, 1857, 444, 504, 948)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-03', 113, 585, 81, 373, 159, 68, 336, 47, 1762, 353, 504, 857)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-10', 132, 532, 65, 335, 164, 57, 322, 47, 1654, 340, 488, 828)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-17', 128, 543, 56, 401, 145, 63, 304, 50, 1690, 322, 494, 816)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-06-24', 113, 539, 44, 394, 157, 76, 338, 51, 1712, 318, 491, 809)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-01', 96, 541, 49, 337, 148, 87, 370, 49, 1677, 288, 497, 785)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-08', 107, 541, 53, 361, 161, 79, 304, 57, 1663, 304, 505, 809)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-15', 85, 544, 46, 351, 136, 82, 304, 44, 1592, 302, 463, 765)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-22', 108, 512, 42, 379, 125, 78, 303, 47, 1594, 274, 471, 745)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-07-29', 104, 529, 31, 397, 131, 71, 318, 37, 1618, 295, 469, 764)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-05', 97, 519, 47, 349, 129, 70, 269, 46, 1526, 297, 448, 745)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-12', 89, 525, 35, 347, 123, 68, 311, 49, 1547, 254, 483, 737)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-19', 113, 516, 22, 327, 103, 75, 306, 59, 1521, 275, 457, 732)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-08-26', 111, 501, 27, 360, 127, 82, 299, 59, 1566, 244, 495, 739)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-02', 90, 498, 37, 343, 115, 70, 261, 45, 1459, 251, 452, 703)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-09', 105, 504, 59, 368, 130, 71, 233, 36, 1506, 255, 484, 739)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-16', 105, 523, 41, 347, 103, 48, 263, 47, 1477, 276, 455, 731)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-23', 79, 479, 40, 327, 127, 71, 272, 58, 1453, 272, 413, 685)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-09-30', 103, 511, 49, 362, 118, 62, 282, 38, 1525, 253, 479, 732)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-07', 89, 517, 61, 366, 107, 65, 244, 72, 1521, 259, 454, 713)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-14', 100, 492, 45, 350, 118, 69, 252, 103, 1529, 250, 460, 710)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-21', 115, 521, 60, 344, 121, 77, 280, 103, 1621, 254, 503, 757)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-10-28', 99, 535, 47, 357, 116, 64, 323, 102, 1643, 237, 513, 750)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-04', 93, 502, 35, 313, 103, 79, 284, 78, 1487, 239, 459, 698)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-11', 92, 506, 39, 310, 107, 63, 303, 102, 1522, 223, 482, 705)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-18', 83, 451, 33, 334, 98, 75, 277, 112, 1463, 214, 418, 632)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-11-25', 83, 481, 32, 334, 128, 74, 317, 107, 1556, 215, 477, 692)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-02', 86, 475, 33, 335, 131, 73, 355, 105, 1593, 227, 465, 692)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-09', 78, 484, 40, 366, 109, 97, 320, 92, 1586, 232, 439, 671)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-16', 82, 489, 47, 332, 124, 74, 308, 92, 1548, 227, 468, 695)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-23', 76, 370, 32, 246, 104, 55, 241, 73, 1197, 170, 380, 550)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2024-12-30', 91, 309, 36, 210, 85, 45, 186, 68, 1030, 160, 325, 485)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-06', 82, 415, 52, 267, 107, 75, 250, 79, 1327, 187, 417, 604)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-13', 88, 467, 45, 290, 99, 71, 270, 88, 1418, 202, 452, 654)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-20', 105, 434, 53, 271, 121, 75, 290, 82, 1431, 202, 458, 660)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-01-27', 97, 510, 39, 312, 106, 77, 336, 89, 1566, 228, 485, 713)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-03', 97, 476, 52, 330, 114, 71, 343, 76, 1559, 195, 492, 687)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-10', 87, 458, 51, 335, 98, 84, 270, 96, 1479, 200, 443, 643)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-17', 110, 487, 48, 325, 107, 84, 309, 78, 1548, 214, 490, 704)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-02-24', 94, 567, 48, 315, 120, 71, 289, 85, 1589, 261, 520, 781)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-03', 97, 535, 43, 363, 115, 81, 295, 97, 1626, 245, 502, 747)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-10', 94, 521, 41, 316, 100, 90, 286, 89, 1537, 234, 481, 715)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-17', 92, 492, 48, 370, 96, 64, 281, 97, 1540, 201, 479, 680)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-24', 94, 574, 44, 349, 100, 83, 268, 83, 1595, 258, 510, 768)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-03-31', 88, 569, 62, 391, 105, 82, 247, 85, 1629, 253, 509, 762)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-07', 91, 528, 39, 387, 90, 63, 266, 105, 1569, 232, 477, 709)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-14', 89, 503, 71, 335, 87, 68, 235, 111, 1499, 228, 451, 679)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-21', 107, 487, 49, 388, 93, 81, 258, 119, 1582, 224, 463, 687)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-04-28', 83, 619, 56, 377, 99, 79, 272, 128, 1713, 244, 557, 801)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-05', 76, 539, 57, 352, 126, 62, 241, 103, 1556, 234, 507, 741)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-12', 93, 526, 61, 343, 85, 73, 227, 107, 1515, 210, 494, 704)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-19', 87, 560, 39, 327, 97, 71, 236, 122, 1539, 226, 518, 744)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-05-26', 78, 602, 58, 373, 106, 78, 262, 117, 1674, 251, 535, 786)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-02', 91, 538, 39, 335, 123, 58, 313, 132, 1629, 232, 520, 752)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-09', 92, 607, 53, 340, 105, 64, 256, 119, 1636, 276, 528, 804)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-16', 92, 555, 46, 363, 92, 69, 285, 127, 1629, 232, 507, 739)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-23', 92, 526, 56, 340, 119, 78, 291, 125, 1627, 221, 516, 737)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-06-30', 89, 564, 47, 355, 107, 72, 234, 117, 1585, 225, 535, 760)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-07', 82, 543, 58, 373, 107, 69, 237, 105, 1574, 229, 503, 732)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-14', 86, 480, 49, 333, 110, 69, 227, 104, 1458, 209, 467, 676)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-21', 88, 516, 62, 280, 102, 90, 202, 104, 1444, 221, 485, 706)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-07-28', 99, 550, 47, 348, 108, 78, 281, 113, 1624, 222, 535, 757)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-04', 82, 509, 49, 328, 91, 70, 224, 89, 1442, 234, 448, 682)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-11', 93, 506, 51, 349, 101, 88, 244, 131, 1563, 216, 484, 700)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-18', 77, 519, 44, 376, 105, 74, 233, 123, 1551, 222, 479, 701)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-08-25', 77, 500, 50, 311, 136, 81, 275, 148, 1578, 218, 495, 713)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-01', 95, 551, 47, 338, 112, 73, 198, 138, 1552, 236, 522, 758)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-08', 89, 518, 48, 352, 108, 86, 165, 115, 1481, 231, 484, 715)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-15', 86, 460, 58, 313, 96, 67, 199, 101, 1380, 214, 428, 642)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-22', 100, 533, 43, 352, 121, 84, 203, 124, 1560, 235, 519, 754)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-09-29', 98, 560, 47, 321, 116, 81, 235, 143, 1601, 251, 523, 774)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-06', 88, 547, 49, 313, 106, 74, 216, 150, 1543, 254, 487, 741)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-13', 95, 523, 76, 300, 102, 64, 226, 136, 1522, 239, 481, 720)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-20', 76, 480, 64, 335, 102, 71, 212, 128, 1468, 194, 464, 658)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-10-27', 88, 516, 69, 286, 111, 97, 239, 157, 1563, 218, 497, 715)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-03', 91, 487, 38, 306, 108, 76, 195, 142, 1443, 183, 503, 686)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-10', 82, 460, 48, 330, 126, 81, 224, 136, 1487, 206, 462, 668)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-17', 86, 427, 47, 324, 110, 76, 221, 132, 1423, 190, 433, 623)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-11-24', 92, 502, 48, 301, 124, 69, 227, 157, 1520, 238, 480, 718)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-01', 94, 467, 37, 308, 106, 89, 225, 147, 1473, 197, 470, 667)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-08', 76, 421, 32, 338, 120, 75, 211, 123, 1396, 177, 440, 617)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-15', 88, 514, 55, 322, 117, 88, 215, 144, 1543, 220, 499, 719)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-22', 55, 313, 24, 292, 94, 70, 182, 111, 1141, 151, 311, 462)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2025-12-29', 74, 419, 33, 277, 104, 68, 185, 136, 1296, 177, 420, 597)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-05', 75, 372, 33, 272, 83, 59, 200, 120, 1214, 151, 379, 530)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-12', 67, 428, 45, 302, 95, 71, 169, 111, 1288, 205, 385, 590)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-19', 78, 492, 45, 290, 92, 71, 175, 107, 1350, 205, 457, 662)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-01-26', 107, 500, 38, 303, 97, 78, 230, 149, 1502, 221, 483, 704)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-02', 80, 482, 38, 344, 102, 91, 184, 149, 1470, 203, 461, 664)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-09', 78, 476, 45, 324, 109, 81, 204, 121, 1438, 189, 474, 663)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-16', 85, 486, 32, 329, 104, 72, 164, 128, 1400, 244, 431, 675)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-02-23', 89, 476, 65, 395, 125, 93, 204, 151, 1598, 209, 481, 690)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-02', 92, 490, 50, 332, 122, 78, 191, 142, 1497, 209, 495, 704)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-09', 79, 485, 44, 345, 94, 83, 177, 133, 1440, 217, 441, 658)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-16', 102, 507, 37, 340, 134, 78, 193, 123, 1514, 218, 525, 743)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-23', 100, 549, 52, 327, 141, 97, 192, 167, 1625, 256, 534, 790)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-03-30', 103, 543, 48, 351, 133, 83, 179, 141, 1581, 247, 532, 779)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-06', 121, 559, 64, 351, 117, 85, 205, 151, 1653, 252, 545, 797)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-13', 106, 870, 58, 641, 122, 93, 200, 145, 2235, 558, 540, 1098)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-20', 92, 1005, 60, 582, 159, 76, 163, 129, 2266, 683, 573, 1256)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-04-27', 110, 932, 65, 502, 163, 72, 170, 140, 2154, 598, 607, 1205)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-04', 89, 972, 42, 475, 153, 85, 148, 132, 2096, 642, 572, 1214)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-11', 100, 1036, 54, 464, 136, 71, 139, 136, 2136, 689, 583, 1272)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
INSERT INTO vm_yoy_both_stores (week_commencing, click_collect, kiosk, till_eat_in, till_takeaway, own_delivery, deliveroo, just_eat, uber_eats, total_orders, new_customers, return_customers, total_customers)
VALUES ('2026-05-18', 88, 603, 59, 316, 163, 83, 174, 143, 1629, 254, 600, 854)
ON CONFLICT (week_commencing) DO UPDATE SET
  click_collect   = EXCLUDED.click_collect,
  kiosk           = EXCLUDED.kiosk,
  till_eat_in     = EXCLUDED.till_eat_in,
  till_takeaway   = EXCLUDED.till_takeaway,
  own_delivery    = EXCLUDED.own_delivery,
  deliveroo       = EXCLUDED.deliveroo,
  just_eat        = EXCLUDED.just_eat,
  uber_eats       = EXCLUDED.uber_eats,
  total_orders    = EXCLUDED.total_orders,
  new_customers   = EXCLUDED.new_customers,
  return_customers = EXCLUDED.return_customers,
  total_customers = EXCLUDED.total_customers;
