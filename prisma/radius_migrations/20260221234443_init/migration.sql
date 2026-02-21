-- CreateTable
CREATE TABLE "radacct" (
    "radacctid" BIGSERIAL NOT NULL,
    "acctsessionid" VARCHAR(64) NOT NULL,
    "acctuniqueid" VARCHAR(32) NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "realm" VARCHAR(64) DEFAULT '',
    "nasipaddress" VARCHAR(15) NOT NULL,
    "nasportid" VARCHAR(32),
    "nasporttype" VARCHAR(32),
    "acctstarttime" TIMESTAMP(6),
    "acctupdatetime" TIMESTAMP(6),
    "acctstoptime" TIMESTAMP(6),
    "acctinterval" INTEGER,
    "acctsessiontime" INTEGER,
    "acctauthentic" VARCHAR(32),
    "connectinfo_start" VARCHAR(120),
    "connectinfo_stop" VARCHAR(120),
    "acctinputoctets" BIGINT,
    "acctoutputoctets" BIGINT,
    "calledstationid" VARCHAR(50),
    "callingstationid" VARCHAR(50),
    "acctterminatecause" VARCHAR(32),
    "servicetype" VARCHAR(32),
    "framedprotocol" VARCHAR(32),
    "framedipaddress" VARCHAR(15),
    "framedipv6address" VARCHAR(45),
    "framedipv6prefix" VARCHAR(45),
    "framedinterfaceid" VARCHAR(44),
    "delegatedipv6prefix" VARCHAR(45),
    "class" VARCHAR(64),

    CONSTRAINT "radacct_pkey" PRIMARY KEY ("radacctid")
);

-- CreateTable
CREATE TABLE "radcheck" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64) NOT NULL DEFAULT '',
    "attribute" VARCHAR(64) NOT NULL DEFAULT '',
    "op" VARCHAR(2) NOT NULL DEFAULT '==',
    "value" VARCHAR(253) NOT NULL DEFAULT '',

    CONSTRAINT "radcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupcheck" (
    "id" SERIAL NOT NULL,
    "groupname" VARCHAR(64) NOT NULL DEFAULT '',
    "attribute" VARCHAR(64) NOT NULL DEFAULT '',
    "op" VARCHAR(2) NOT NULL DEFAULT '==',
    "value" VARCHAR(253) NOT NULL DEFAULT '',

    CONSTRAINT "radgroupcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupreply" (
    "id" SERIAL NOT NULL,
    "groupname" VARCHAR(64) NOT NULL DEFAULT '',
    "attribute" VARCHAR(64) NOT NULL DEFAULT '',
    "op" VARCHAR(2) NOT NULL DEFAULT '=',
    "value" VARCHAR(253) NOT NULL DEFAULT '',

    CONSTRAINT "radgroupreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radreply" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64) NOT NULL DEFAULT '',
    "attribute" VARCHAR(64) NOT NULL DEFAULT '',
    "op" VARCHAR(2) NOT NULL DEFAULT '=',
    "value" VARCHAR(253) NOT NULL DEFAULT '',

    CONSTRAINT "radreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radusergroup" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64) NOT NULL DEFAULT '',
    "groupname" VARCHAR(64) NOT NULL DEFAULT '',
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "radusergroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radpostauth" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64) NOT NULL DEFAULT '',
    "pass" VARCHAR(64) DEFAULT '',
    "reply" VARCHAR(32) DEFAULT '',
    "authdate" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "class" VARCHAR(64),

    CONSTRAINT "radpostauth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nas" (
    "id" SERIAL NOT NULL,
    "nasname" VARCHAR(128) NOT NULL,
    "shortname" VARCHAR(32),
    "type" VARCHAR(30) DEFAULT 'other',
    "ports" INTEGER,
    "secret" VARCHAR(60) NOT NULL,
    "server" VARCHAR(64),
    "community" VARCHAR(50),
    "description" VARCHAR(200),

    CONSTRAINT "nas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radippool" (
    "id" SERIAL NOT NULL,
    "pool_name" VARCHAR(30) NOT NULL,
    "framedipaddress" VARCHAR(15) NOT NULL,
    "nasipaddress" VARCHAR(15) NOT NULL,
    "calledstationid" VARCHAR(30) NOT NULL,
    "callingstationid" VARCHAR(30) NOT NULL,
    "expiry_time" TIMESTAMP(6),
    "username" VARCHAR(64) NOT NULL,
    "pool_key" VARCHAR(30) NOT NULL,

    CONSTRAINT "radippool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "radacct_acctuniqueid_key" ON "radacct"("acctuniqueid");

-- CreateIndex
CREATE INDEX "radacct_acctsessionid_idx" ON "radacct"("acctsessionid");

-- CreateIndex
CREATE INDEX "radacct_acctsessiontime_idx" ON "radacct"("acctsessiontime");

-- CreateIndex
CREATE INDEX "radacct_acctstarttime_idx" ON "radacct"("acctstarttime");

-- CreateIndex
CREATE INDEX "radacct_acctstoptime_idx" ON "radacct"("acctstoptime");

-- CreateIndex
CREATE INDEX "radacct_calledstationid_idx" ON "radacct"("calledstationid");

-- CreateIndex
CREATE INDEX "radacct_callingstationid_idx" ON "radacct"("callingstationid");

-- CreateIndex
CREATE INDEX "radacct_class_idx" ON "radacct"("class");

-- CreateIndex
CREATE INDEX "radacct_framedipaddress_idx" ON "radacct"("framedipaddress");

-- CreateIndex
CREATE INDEX "radacct_framedipv6address_idx" ON "radacct"("framedipv6address");

-- CreateIndex
CREATE INDEX "radacct_framedipv6prefix_idx" ON "radacct"("framedipv6prefix");

-- CreateIndex
CREATE INDEX "radacct_nasipaddress_idx" ON "radacct"("nasipaddress");

-- CreateIndex
CREATE INDEX "radacct_username_idx" ON "radacct"("username");

-- CreateIndex
CREATE INDEX "radcheck_username_idx" ON "radcheck"("username");

-- CreateIndex
CREATE INDEX "radgroupcheck_groupname_idx" ON "radgroupcheck"("groupname");

-- CreateIndex
CREATE INDEX "radgroupreply_groupname_idx" ON "radgroupreply"("groupname");

-- CreateIndex
CREATE INDEX "radreply_username_idx" ON "radreply"("username");

-- CreateIndex
CREATE INDEX "radusergroup_username_idx" ON "radusergroup"("username");

-- CreateIndex
CREATE INDEX "radpostauth_class_idx" ON "radpostauth"("class");

-- CreateIndex
CREATE INDEX "radpostauth_username_idx" ON "radpostauth"("username");

-- CreateIndex
CREATE INDEX "nas_nasname_idx" ON "nas"("nasname");

-- CreateIndex
CREATE INDEX "radippool_framedipaddress_idx" ON "radippool"("framedipaddress");

-- CreateIndex
CREATE INDEX "radippool_poolname_expire_idx" ON "radippool"("pool_name", "expiry_time");

-- CreateIndex
CREATE INDEX "radippool_poolname_poolkey_ipaddress_idx" ON "radippool"("pool_name", "pool_key", "framedipaddress");
