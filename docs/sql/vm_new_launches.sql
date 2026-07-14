-- ============================================================================
-- New Launches — VM analytics (run in the VM Supabase project)
-- Curated list of recently launched menu items, powering the "New Launches"
-- section on the Product Performance dashboard.
--
-- HOW IT WORKS
--   * One row per raw sales-data item_name that should count as a new launch.
--   * Several raw variants can share a display_name; the dashboard rolls them
--     up into a single line (matching is case/spacing/punctuation-insensitive).
--   * launch_date is informational only — items stay in the report until you
--     delete their row(s) here. Leave it NULL if unknown; the report shows "—".
--
-- ADD A LAUNCH   : insert a row (item_name = exact sales-data name, display_name
--                  = label to show, launch_date = when it launched).
-- RETIRE A LAUNCH: delete its row(s).
-- Re-runnable: table upserts on conflict.
-- ============================================================================

create table if not exists vm_new_launches (
  item_name    text primary key,        -- raw name as it appears in sales data
  display_name text not null,           -- label shown in the report (variants share one)
  launch_date  date,                    -- informational; NULL = unknown ("—")
  updated_at   timestamptz not null default now()
);

-- Seeded from the store's "What's new?" menu category (Peckers Hitchin).
-- launch_date is left NULL — fill it in with the UPDATE snippets at the bottom
-- once the real launch dates are confirmed.
insert into vm_new_launches (item_name, display_name, launch_date) values
  -- Mango Pineapple range --------------------------------------------------
  ('Mango Pineapple Glazed Southern Fried Buttermilk Tenders', 'Mango Pineapple Glazed Tenders', null),
  ('Mango Pineapple Glazed Tenders',                           'Mango Pineapple Glazed Tenders', null),
  ('Southern fried Mango Pineappled Glazed Tenders',           'Mango Pineapple Glazed Tenders', null),
  ('Mango Pineapple Glazed Southern Fried Wings',              'Mango Pineapple Glazed Wings',   null),
  ('Mango Pineapple Glazed Wings',                             'Mango Pineapple Glazed Wings',   null),
  ('Mango Pineapple Milkshake',                                'Mango Pineapple Milkshake',      null),
  -- Matcha range -----------------------------------------------------------
  ('Og Matcha',                                                'Og Matcha',                      null),
  ('Oreo Crumble Matcha',                                      'Oreo Crumble Matcha',            null),
  ('Strawberry Matcha',                                        'Strawberry Matcha',              null),
  -- Katsu Curry range ------------------------------------------------------
  ('Katsu Curry Burger',                                       'Katsu Curry Burger',             null),
  ('Katsu Curry Rice bowl',                                    'Katsu Curry Rice Bowl',          null),
  ('Katsu Curry Salad Bowl',                                   'Katsu Curry Salad Bowl',         null),
  ('Katsu Curry Wrap',                                         'Katsu Curry Wrap',               null),
  ('Katsu Curry Tenders',                                      'Katsu Curry Tenders',            null),
  ('2 Katsu Curry Tenders',                                    'Katsu Curry Tenders',            null),
  ('Katsu Curry Wings',                                        'Katsu Curry Wings',              null),
  ('3 Katsu Curry Wings',                                      'Katsu Curry Wings',              null)
on conflict (item_name) do update
  set display_name = excluded.display_name,
      launch_date  = coalesce(excluded.launch_date, vm_new_launches.launch_date),
      updated_at   = now();

-- ----------------------------------------------------------------------------
-- Fill in launch dates once confirmed (one per display_name group), e.g.:
--   update vm_new_launches set launch_date = '2026-06-30'
--     where display_name in ('Mango Pineapple Glazed Tenders',
--                            'Mango Pineapple Glazed Wings',
--                            'Mango Pineapple Milkshake');
--   update vm_new_launches set launch_date = '2026-06-16'
--     where display_name in ('Og Matcha','Oreo Crumble Matcha','Strawberry Matcha');
--   update vm_new_launches set launch_date = '2026-05-19'
--     where display_name like 'Katsu Curry%';
-- ----------------------------------------------------------------------------
