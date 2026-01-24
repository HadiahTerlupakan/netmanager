INSERT INTO "Permission" ("id", "name", "action", "resource", "description", "updatedAt") VALUES
('ACE23A2C-315D-4150-922B-D924740BAB4E', 'Cancel Workorders', 'cancel', 'workorders', 'Allow cancel on workorders', NOW()),
('ACE23A2C-315D-4150-922B-D924740BAB4F', 'Verify Workorders', 'verify', 'workorders', 'Allow verify on workorders', NOW()),
('ACE23A2C-315D-4150-922B-D924740BAB50', 'Cancel List', 'cancel', 'list', 'Allow cancel on list', NOW()),
('ACE23A2C-315D-4150-922B-D924740BAB51', 'Verify List', 'verify', 'list', 'Allow verify on list', NOW())
ON CONFLICT ("resource", "action") DO NOTHING;
