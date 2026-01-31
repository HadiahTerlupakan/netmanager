-- CreateTable
CREATE TABLE "mapping_nodes" (
    "node_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "splitter" TEXT,
    "pppoe" TEXT,
    "serialnumber" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapping_nodes_pkey" PRIMARY KEY ("node_id")
);

-- CreateTable
CREATE TABLE "mapping_edges" (
    "edge_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "fiber_type" TEXT,
    "distance" DOUBLE PRECISION,
    "waypoints" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapping_edges_pkey" PRIMARY KEY ("edge_id")
);

-- CreateTable
CREATE TABLE "map_settings" (
    "id" SERIAL NOT NULL,
    "center_lat" TEXT,
    "center_lng" TEXT,
    "max_zoom_in" TEXT,
    "max_zoom_out" TEXT,
    "default_zoom" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "map_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mapping_edges_source_idx" ON "mapping_edges"("source");

-- CreateIndex
CREATE INDEX "mapping_edges_target_idx" ON "mapping_edges"("target");

-- AddForeignKey
ALTER TABLE "mapping_edges" ADD CONSTRAINT "mapping_edges_source_fkey" FOREIGN KEY ("source") REFERENCES "mapping_nodes"("node_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_edges" ADD CONSTRAINT "mapping_edges_target_fkey" FOREIGN KEY ("target") REFERENCES "mapping_nodes"("node_id") ON DELETE RESTRICT ON UPDATE CASCADE;
