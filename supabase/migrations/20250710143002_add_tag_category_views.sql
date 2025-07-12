-- Add asset_tag_categories materialized view
-- This view extracts distinct tag categories (part before ':') for each quest via asset tags
CREATE MATERIALIZED VIEW asset_tag_categories AS
SELECT
  q.id AS quest_id,
  array_agg(DISTINCT split_part(t.name, ':', 1)) AS tag_categories
FROM
  quest q
  JOIN quest_asset_link qal ON q.id = qal.quest_id
  JOIN asset a ON qal.asset_id = a.id
  JOIN asset_tag_link atl ON a.id = atl.asset_id
  JOIN tag t ON atl.tag_id = t.id
GROUP BY
  q.id
ORDER BY
  q.id;

-- Add quest_tag_categories materialized view
-- This view extracts distinct tag categories for all quests in each project
CREATE MATERIALIZED VIEW quest_tag_categories AS
SELECT
  p.id AS project_id,
  array_agg(DISTINCT split_part(t.name, ':', 1)) AS tag_categories
FROM 
  project p
JOIN 
  quest q ON q.project_id = p.id
JOIN 
  quest_asset_link qal ON q.id = qal.quest_id
JOIN 
  asset a ON qal.asset_id = a.id
JOIN 
  asset_tag_link atl ON a.id = atl.asset_id
JOIN 
  tag t ON atl.tag_id = t.id
GROUP BY
  p.id
ORDER BY
  p.id;

-- Function to refresh asset_tag_categories materialized view
CREATE OR REPLACE FUNCTION refresh_asset_tag_categories()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY asset_tag_categories;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh quest_tag_categories materialized view
CREATE OR REPLACE FUNCTION refresh_quest_tag_categories()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY quest_tag_categories;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for asset_tag_categories (refresh when asset_tag_link changes)
CREATE TRIGGER trigger_refresh_asset_tag_categories_on_asset_tag_link
  AFTER INSERT OR UPDATE OR DELETE ON asset_tag_link
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_asset_tag_categories();

-- Triggers for asset_tag_categories (refresh when quest_asset_link changes)
CREATE TRIGGER trigger_refresh_asset_tag_categories_on_quest_tag_link
  AFTER INSERT OR UPDATE OR DELETE ON quest_tag_link
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_asset_tag_categories();

-- Note: Row Level Security (RLS) is not supported on materialized views in PostgreSQL
-- Security will need to be handled at the application level or through wrapper views 