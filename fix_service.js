const fs = require('fs');
let file = fs.readFileSync('modules/marketing/services/CanvasingService.ts', 'utf8');

// Fix rejectRequest
file = file.replace(
    /async rejectRequest\(id: string\): Promise<Canvasing> \{([\s\S]*?)const rejected = await this\.repository\.update\(id, \{ status: 'REJECTED' \}\)/,
    "async rejectRequest(id: string, rejectReason?: string): Promise<Canvasing> {\n    // Get request to notify sales\n    const request = await this.repository.findById(id)\n    \n    const rejected = await this.repository.update(id, { status: 'REJECTED', rejectReason: rejectReason || null })"
);

// Fix approveRequest ts-expect-error and add point claims
file = file.replace(
    /\/\/ @ts-expect-error - approvedBy and workOrderId fields exist in schema but may not be in type definition\n\s*approvedBy: approverId,/,
    "approvedBy: approverId,"
);

// Add foto and fotoKtp to WorkOrder creation
file = file.replace(
    /locationAddress: request\.alamat,/,
    "locationAddress: request.alamat,\n      ...(request.foto ? { fotoRumah: request.foto } : {}),\n      ...(request.fotoKtp ? { fotoKtp: request.fotoKtp } : {}),"
);

fs.writeFileSync('modules/marketing/services/CanvasingService.ts', file);
