import fs from 'fs';

// 1. ICanvasingRepository
let iRepo = fs.readFileSync('modules/marketing/repositories/ICanvasingRepository.ts', 'utf8');
if (!iRepo.includes('findByWorkOrderId')) {
    iRepo = iRepo.replace(
        /findById\(id: string\): Promise<Canvasing \| null>/,
        "findById(id: string): Promise<Canvasing | null>\n  findByWorkOrderId(workOrderId: string): Promise<Canvasing | null>"
    );
    fs.writeFileSync('modules/marketing/repositories/ICanvasingRepository.ts', iRepo);
}

// 2. PrismaCanvasingRepository
let pRepo = fs.readFileSync('modules/marketing/repositories/PrismaCanvasingRepository.ts', 'utf8');
if (!pRepo.includes('findByWorkOrderId')) {
    pRepo = pRepo.replace(
        /async findById\(id: string\): Promise<Canvasing \| null> \{/,
        "async findByWorkOrderId(workOrderId: string): Promise<Canvasing | null> {\n    return this.prisma.canvasing.findFirst({\n      where: { workOrderId }\n    })\n  }\n\n  async findById(id: string): Promise<Canvasing | null> {"
    );
    fs.writeFileSync('modules/marketing/repositories/PrismaCanvasingRepository.ts', pRepo);
}

// 3. CanvasingRepository (the mock one if it exists?)
let cRepoPath = 'modules/marketing/repositories/CanvasingRepository.ts';
if (fs.existsSync(cRepoPath)) {
    let cRepo = fs.readFileSync(cRepoPath, 'utf8');
    if (!cRepo.includes('findByWorkOrderId')) {
        cRepo = cRepo.replace(
            /async findById\(id: string\): Promise<CanvasingWithRelations \| null> \{/,
            "async findByWorkOrderId(workOrderId: string): Promise<CanvasingWithRelations | null> {\n    return prisma.canvasing.findFirst({\n      where: { workOrderId },\n      include: {\n        site: {\n          select: {\n            name: true\n          }\n        },\n        sales: {\n          select: {\n            id: true,\n            name: true,\n            email: true,\n            role: {\n              select: {\n                name: true\n              }\n            }\n          }\n        }\n      }\n    })\n  }\n\n  async findById(id: string): Promise<CanvasingWithRelations | null> {"
        );
        fs.writeFileSync(cRepoPath, cRepo);
    }
}
