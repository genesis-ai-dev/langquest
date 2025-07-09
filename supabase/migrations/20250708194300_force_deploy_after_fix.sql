-- This migration forces a redeploy after fixing the duplicate function issue in 20250708194100
-- The previous migration failed due to duplicate rebuild_all_project_closures function definitions
create table if not exists temp_force_redeploy_fix (id serial primary key);
drop table if exists temp_force_redeploy_fix; 