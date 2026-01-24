import { getMixRadiusService } from './modules/integrations/mixradius/MixRadiusService';
async function main() {
  try {
    const service = getMixRadiusService();
    const groups = await service.getOwnerGroups();
    console.log('Groups with Site relation:', JSON.stringify(groups, null, 2));
  } catch (err) {
    console.error('Test failed:', err);
  }
}
main();
