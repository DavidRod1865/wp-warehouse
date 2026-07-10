-- Create materialized view for driver performance analytics
-- This view aggregates delivery metrics by driver for dashboard reporting

CREATE MATERIALIZED VIEW driver_performance AS
SELECT
  d.driver_id,
  u.username,
  COUNT(*) FILTER (WHERE d.status = 'delivered') as completed_deliveries,
  COUNT(*) FILTER (WHERE d.status = 'partial') as partial_deliveries,
  COUNT(*) as total_deliveries,
  AVG(EXTRACT(EPOCH FROM (d.delivered_at - d.started_at))/3600) as avg_delivery_hours,
  SUM(di.delivered_quantity) as total_items_delivered,
  COUNT(DISTINCT d.project_id) as unique_projects_served,
  MAX(d.delivered_at) as last_delivery_date
FROM deliveries d
LEFT JOIN users u ON u.id = d.driver_id
LEFT JOIN delivery_items di ON di.delivery_id = d.id
WHERE d.deleted_at IS NULL
  AND d.status IN ('delivered', 'partial')
  AND d.driver_id IS NOT NULL
GROUP BY d.driver_id, u.username;

-- Create index for fast lookups by driver_id
CREATE UNIQUE INDEX idx_driver_performance_driver_id ON driver_performance(driver_id);

-- Add comment for documentation
COMMENT ON MATERIALIZED VIEW driver_performance IS 'Aggregated driver performance metrics including completed deliveries, average delivery time, and total items delivered. Refresh regularly to keep data current.';

-- Create refresh function for scheduled or manual updates
CREATE OR REPLACE FUNCTION refresh_driver_performance()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY driver_performance;
END;
$$ LANGUAGE plpgsql;

-- Add comment for the refresh function
COMMENT ON FUNCTION refresh_driver_performance() IS 'Refreshes the driver_performance materialized view. Call this after delivery updates to keep metrics current. Uses CONCURRENTLY to avoid locking the view during refresh.';
