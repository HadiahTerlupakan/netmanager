const fs = require('fs');
let file = fs.readFileSync('lib/repositories/index.ts', 'utf8');

// Add PointClaimRepository import
if (!file.includes('getPointClaimRepository')) {
   file = file.replace(/export function getCanvasingService/, "export function getPointClaimRepository() {\n  if (!pointClaimRepositoryInstance) {\n    pointClaimRepositoryInstance = new PrismaPointClaimRepository(prisma)\n  }\n  return pointClaimRepositoryInstance\n}\n\nexport function getCanvasingService");
}

file = file.replace(
   /canvasingServiceInstance = new CanvasingService\(\n\s*getCanvasingRepository\(\),\n\s*getWorkOrderRepository\(\)\n\s*\)/,
   "canvasingServiceInstance = new CanvasingService(\n      getCanvasingRepository(),\n      getWorkOrderRepository(),\n      getPointClaimRepository()\n    )"
);

fs.writeFileSync('lib/repositories/index.ts', file);
