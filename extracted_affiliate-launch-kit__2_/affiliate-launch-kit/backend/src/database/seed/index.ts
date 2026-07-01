import dataSource from '../data-source';
import { Template, License } from '../entities';
import { PROMPT_TEMPLATES } from '../../modules/generators/ai-engine/prompt-templates';
import { ALL_ASSET_TYPES, AssetType } from '../../modules/generators/generators.types';

/**
 * Seeds:
 *  - The 5 prompt templates (one active per asset_type) from Section 3.
 *  - One active test license (key ALK-DEMO-TEST-0001-0001) for local dev/testing.
 */
async function main() {
  await dataSource.initialize();
  const templateRepo = dataSource.getRepository(Template);
  const licenseRepo = dataSource.getRepository(License);

  for (const assetType of ALL_ASSET_TYPES) {
    const tpl = PROMPT_TEMPLATES[assetType as AssetType];
    const combined = `${tpl.system} ||| ${tpl.user}`;
    const existing = await templateRepo.findOne({ where: { asset_type: assetType, is_active: true } });
    if (existing) {
      existing.prompt_template = combined;
      existing.version = existing.version + 1;
      await templateRepo.save(existing);
      console.log(`[seed] updated template for ${assetType}`);
    } else {
      await templateRepo.save(
        templateRepo.create({
          asset_type: assetType,
          prompt_template: combined,
          version: 1,
          is_active: true,
        }),
      );
      console.log(`[seed] created template for ${assetType}`);
    }
  }

  // Test license (active) so the full authenticated flow can be exercised.
  const testKey = 'ALK-DEMO-TEST-0001-0001';
  let license = await licenseRepo.findOne({ where: { license_key: testKey } });
  if (!license) {
    license = licenseRepo.create({
      license_key: testKey,
      source: 'jvzoo',
      jvzoo_transaction_id: 'JVZ-TEST-0001',
      status: 'active',
    });
    await licenseRepo.save(license);
    console.log(`[seed] created test license ${testKey}`);
  } else {
    console.log(`[seed] test license ${testKey} already present`);
  }

  await dataSource.destroy();
  console.log('[seed] done');
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
