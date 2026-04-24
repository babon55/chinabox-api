--
-- PostgreSQL database dump
--

\restrict FJow4HnDKz5K1yJycSy94qtLOI5T5L34Ia4vy8SHVtXIGRpBnxoDZE2TLOOgLVo

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: CustomerStatus; Type: TYPE; Schema: public; Owner: silkshop_user
--

CREATE TYPE public."CustomerStatus" AS ENUM (
    'ACTIVE',
    'BLOCKED'
);


ALTER TYPE public."CustomerStatus" OWNER TO silkshop_user;

--
-- Name: DeliveryType; Type: TYPE; Schema: public; Owner: silkshop_user
--

CREATE TYPE public."DeliveryType" AS ENUM (
    'simple',
    'fast'
);


ALTER TYPE public."DeliveryType" OWNER TO silkshop_user;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: silkshop_user
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);


ALTER TYPE public."OrderStatus" OWNER TO silkshop_user;

--
-- Name: ProductRequestStatus; Type: TYPE; Schema: public; Owner: silkshop_user
--

CREATE TYPE public."ProductRequestStatus" AS ENUM (
    'NEW',
    'SEEN',
    'ADDED',
    'REJECTED'
);


ALTER TYPE public."ProductRequestStatus" OWNER TO silkshop_user;

--
-- Name: ProductStatus; Type: TYPE; Schema: public; Owner: silkshop_user
--

CREATE TYPE public."ProductStatus" AS ENUM (
    'ACTIVE',
    'DRAFT',
    'ARCHIVED'
);


ALTER TYPE public."ProductStatus" OWNER TO silkshop_user;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: silkshop_user
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'MANAGER',
    'VIEWER'
);


ALTER TYPE public."Role" OWNER TO silkshop_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Category; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    "nameTk" text NOT NULL,
    "nameRu" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "parentId" text,
    "imageUrl" text
);


ALTER TABLE public."Category" OWNER TO silkshop_user;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "productId" text NOT NULL,
    "customerId" text NOT NULL,
    rating integer NOT NULL,
    text text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Comment" OWNER TO silkshop_user;

--
-- Name: Customer; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    address text,
    status public."CustomerStatus" DEFAULT 'ACTIVE'::public."CustomerStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "passwordHash" text,
    "googleId" text
);


ALTER TABLE public."Customer" OWNER TO silkshop_user;

--
-- Name: Order; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    total numeric(10,2) NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deliveryType" public."DeliveryType" DEFAULT 'simple'::public."DeliveryType" NOT NULL,
    "homeDelivery" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Order" OWNER TO silkshop_user;

--
-- Name: OrderLine; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."OrderLine" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text NOT NULL,
    qty integer NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public."OrderLine" OWNER TO silkshop_user;

--
-- Name: Product; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    "nameTk" text NOT NULL,
    "nameRu" text NOT NULL,
    "categoryId" text NOT NULL,
    image text DEFAULT '📦'::text NOT NULL,
    price numeric(10,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    sold integer DEFAULT 0 NOT NULL,
    status public."ProductStatus" DEFAULT 'ACTIVE'::public."ProductStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "imageUrl" text,
    "weightG" integer,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    "imageUrls" text[] DEFAULT ARRAY[]::text[],
    markup integer DEFAULT 50 NOT NULL,
    "descriptionRu" text,
    "descriptionTk" text
);


ALTER TABLE public."Product" OWNER TO silkshop_user;

--
-- Name: ProductRequest; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."ProductRequest" (
    id text NOT NULL,
    "nameTk" text NOT NULL,
    "nameRu" text NOT NULL,
    description text,
    "imageUrl" text,
    "contactName" text NOT NULL,
    "contactPhone" text,
    "contactEmail" text,
    status public."ProductRequestStatus" DEFAULT 'NEW'::public."ProductRequestStatus" NOT NULL,
    "adminNote" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ProductRequest" OWNER TO silkshop_user;

--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."RefreshToken" (
    id text NOT NULL,
    token text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RefreshToken" OWNER TO silkshop_user;

--
-- Name: StoreSettings; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."StoreSettings" (
    id text DEFAULT 'singleton'::text NOT NULL,
    "nameTk" text DEFAULT 'SilkShop'::text NOT NULL,
    "nameRu" text DEFAULT 'SilkShop'::text NOT NULL,
    "taglineTk" text DEFAULT 'Iň gowy önümler'::text NOT NULL,
    "taglineRu" text DEFAULT 'Лучшие товары'::text NOT NULL,
    email text DEFAULT 'info@silkshop.tm'::text NOT NULL,
    phone text DEFAULT '+993 12 123456'::text NOT NULL,
    "addressTk" text DEFAULT 'Aşgabat, Türkmenistan'::text NOT NULL,
    "addressRu" text DEFAULT 'Ашхабад, Туркменистан'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    logo text DEFAULT '🛍️'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."StoreSettings" OWNER TO silkshop_user;

--
-- Name: User; Type: TABLE; Schema: public; Owner: silkshop_user
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'ADMIN'::public."Role" NOT NULL,
    avatar text DEFAULT '👤'::text NOT NULL,
    phone text,
    timezone text DEFAULT 'Asia/Ashgabat'::text NOT NULL,
    "langPref" text DEFAULT 'tk'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO silkshop_user;

--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."Category" (id, "nameTk", "nameRu", "createdAt", "parentId", "imageUrl") FROM stdin;
cat-2	Aksesuar	Аксессуары	2026-03-12 13:51:55.52	\N	\N
cat-5	Öý üçin	Для дома	2026-03-12 13:51:55.521	\N	\N
cat-1	Elektronika	Электроника	2026-03-12 13:51:55.52	\N	\N
cat-4	Gözellik	Красота	2026-03-12 13:51:55.52	\N	\N
cmo4d3lqr0001cz6fcyy0gga0	salam	salam	2026-04-18 13:17:34.036	cat-3	\N
cmo4d5pd30005cz6f2ukd2h9k	test	test	2026-04-18 13:19:12.039	cat-3	\N
cat-3	Egin-eşik	Одежда	2026-03-12 13:51:55.52	\N	\N
cmo79isjm0003enfuus7uborg	sa	sa	2026-04-20 14:00:42.754	cat-3	\N
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."Comment" (id, "productId", "customerId", rating, text, "createdAt", "updatedAt") FROM stdin;
cmn2y3xoz0005kxdbgyu3r24e	cmmp2vmn20003pgmvku737f3a	cmmyjcyvf000440c7xv6t3akr	4	zdzvd	2026-03-23 08:50:26.771	2026-03-23 08:50:26.771
cmo1xsjlc0003138q06jnhgse	cmmtc0f3g0003xie5f50g78s2	cmmyjcyvf000440c7xv6t3akr	3	qwdwqd	2026-04-16 20:33:31.44	2026-04-16 20:33:31.44
cmo4rixva0001tqlrrekhok2t	cmmxhqnlr0001tcacoxizwb0v	cmmyjcyvf000440c7xv6t3akr	4	test	2026-04-18 20:01:24.214	2026-04-18 20:01:24.214
cmo4rj7zs0003tqlr82lpitrg	cmmxhqnlr0001tcacoxizwb0v	cmmyjcyvf000440c7xv6t3akr	3	works	2026-04-18 20:01:37.336	2026-04-18 20:01:37.336
\.


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."Customer" (id, name, email, phone, address, status, "createdAt", "updatedAt", "passwordHash", "googleId") FROM stdin;
cst-001	Merdan Ataýew	merdan@mail.com	+993 65 123456	Aşgabat, Bitarap Türkmenistan köç. 12	ACTIVE	2026-03-12 13:51:55.729	2026-03-12 13:51:55.729	\N	\N
cst-002	Aýna Durdyýewa	ayna@mail.com	+993 62 654321	Aşgabat, Görogly köç. 44	ACTIVE	2026-03-12 13:51:55.729	2026-03-12 13:51:55.729	\N	\N
cst-004	Güljeren Orazowa	guljeren@mail.com	+993 63 112233	Türkmenabat, Magtymguly köç. 3	ACTIVE	2026-03-12 13:51:55.729	2026-03-12 13:51:55.729	\N	\N
cst-005	Döwlet Hojamow	dowlet@mail.com	+993 64 445566	Balkanabat, Ruhy köç. 18	BLOCKED	2026-03-12 13:51:55.734	2026-03-12 13:51:55.734	\N	\N
cst-003	Serdar Nurýew	serdar@mail.com	+993 61 987654	Mary, Mollanepes köç. 7	ACTIVE	2026-03-12 13:51:55.729	2026-03-12 13:51:55.729	\N	\N
cst-006	Orazgül Annaýewa	orazgul@mail.com	+993 65 778899	Aşgabat, Andalyp köç. 56	BLOCKED	2026-03-12 13:51:55.738	2026-03-17 14:26:06.579	\N	\N
cst-007	Baýram Myradow	bayram@mail.com	+993 62 334455	Daşoguz, Nurmuhammet Andalyp köç. 2	BLOCKED	2026-03-12 13:51:55.738	2026-03-17 14:26:16.418	\N	\N
cst-008	Maral Halmyradowa	maral@mail.com	+993 61 667788	Aşgabat, Oguzhan köç. 9	ACTIVE	2026-03-17 15:59:33.805	2026-03-17 15:59:33.805	\N	\N
cmmw5462v0000ccqawlnx5kae	ew ed	easdj@gmail.com	+99362160072		ACTIVE	2026-03-18 14:32:11.72	2026-03-18 14:32:11.72	3de205b600f1bcdbb5951e7c267f0fa7c8fe44835f3aa292a6d91f408ad64c8b	\N
cmntc7ysm0002qqonk85um1nl	Babanazar Jumadurdyyev	abanazarjumadurdyyev@gmail.com	babanazarjumadurdyyev@gmail.com		ACTIVE	2026-04-10 20:07:30.022	2026-04-10 20:07:30.022	e1e766ff968b6c3a8826089465de14d32290c6a7bce964e327eb0186ff0e2fc0	\N
cmnqgw8vs0002wpjaj6a4r0tr	Math Olimpics	olimpicsmath@gmail.com	+993 62160072		ACTIVE	2026-04-08 19:55:02.776	2026-04-13 11:45:06.477	a5dbdc183fec3d432479ea8a32fb13581335507f8b4dcaebb77d7d2977d3b38b	112878847617417457145
cmnx7h7sm0008rumv6f166caz	Jumadurdyyev	jumadurdyyev29@gmail.com	\N	\N	ACTIVE	2026-04-13 13:05:48.215	2026-04-13 13:05:48.215	\N	115971737669444815351
cmmyjcyvf000440c7xv6t3akr	Babanazar Jumadurdyyev	babanazarjumadurdyyev@gmail.com	+99362160072		ACTIVE	2026-03-20 06:46:29.26	2026-04-16 03:45:17.314	fc993939a93be82aed098eb64200bc718408c7fcdae2929dc006d10dfc7e42c2	110223791534888522177
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."Order" (id, "customerId", total, status, note, "createdAt", "updatedAt", "deliveryType", "homeDelivery") FROM stdin;
cmn03vo8z0003p3fv6hhuyjzl	cmmw5462v0000ccqawlnx5kae	27.00	PENDING	\N	2026-03-21 09:08:40.452	2026-03-21 09:08:40.452	simple	f
cmn03xi3f0008p3fvxyyv473b	cmmyjcyvf000440c7xv6t3akr	12.00	CANCELLED	\N	2026-03-21 09:10:05.788	2026-03-21 09:10:21.141	simple	f
cmn04a1ir000ep3fvp0i3885z	cmmw5462v0000ccqawlnx5kae	27.00	PENDING	\N	2026-03-21 09:19:50.835	2026-03-21 09:19:50.835	simple	f
cmn04f9860001pbt7xqfplyqb	cmmw5462v0000ccqawlnx5kae	12.00	PENDING	\N	2026-03-21 09:23:54.102	2026-03-21 09:23:54.102	simple	f
cmn1bx5bw0001pfim71oeeizv	cmmw5462v0000ccqawlnx5kae	12.00	PENDING	\N	2026-03-22 05:41:32.346	2026-03-22 05:41:32.346	simple	f
cmn643kt90001ugpr8fncet3u	cmmw5462v0000ccqawlnx5kae	15.00	PENDING	\N	2026-03-25 14:01:26.297	2026-03-25 14:01:26.297	simple	f
cmn91mfxm00034qlzcmy3lagi	cmmw5462v0000ccqawlnx5kae	42.50	PENDING	\N	2026-03-27 15:15:26.123	2026-03-27 15:15:26.123	simple	f
cmnbiiofc0001k5asysrkscd6	cmmyjcyvf000440c7xv6t3akr	67.50	PROCESSING	\N	2026-03-29 08:43:56.324	2026-03-29 08:45:17.714	simple	f
ord-001	cst-001	50.97	DELIVERED	\N	2026-04-03 13:12:05.558	2026-04-03 13:12:05.558	simple	f
ord-002	cst-002	89.99	SHIPPED	Sowgat bukjasy bilen iberilmegini haýyş edýärin.	2026-04-03 13:12:05.573	2026-04-03 13:12:05.573	simple	f
ord-003	cst-003	113.48	PROCESSING	\N	2026-04-03 13:12:05.577	2026-04-03 13:12:05.577	simple	f
ord-004	cst-004	24.97	PENDING	\N	2026-04-03 13:12:05.581	2026-04-03 13:12:05.581	simple	f
ord-005	cst-005	99.97	CANCELLED	Müşderi yzyna gaýtarma talap etdi.	2026-04-03 13:12:05.586	2026-04-03 13:12:05.586	simple	f
ord-006	cst-006	84.98	PENDING	\N	2026-04-03 13:12:05.59	2026-04-03 13:12:05.59	simple	f
ord-007	cst-007	79.96	SHIPPED	\N	2026-04-03 13:12:05.594	2026-04-03 13:12:05.594	simple	f
cmnj1hfe80001b1bldc35g9di	cmmyjcyvf000440c7xv6t3akr	122.00	PENDING	\N	2026-04-03 15:09:13.905	2026-04-03 15:09:13.905	simple	f
cmnkeisbc00019j0t30s20t9j	cmmyjcyvf000440c7xv6t3akr	55.00	PROCESSING	\N	2026-04-04 14:01:58.485	2026-04-04 14:15:19.952	simple	f
cmnkfbtqu0001xdgtrzaes1rn	cmmyjcyvf000440c7xv6t3akr	110.00	PENDING	\N	2026-04-04 14:24:33.367	2026-04-04 14:29:48.238	simple	f
cmnkfnlx10005xdgtw87ojf5d	cmmyjcyvf000440c7xv6t3akr	110.00	PENDING	\N	2026-04-04 14:33:43.094	2026-04-04 14:33:43.094	simple	f
cmnkgqe11000bxdgtcg5imtq3	cmmyjcyvf000440c7xv6t3akr	110.00	PENDING	\N	2026-04-04 15:03:52.453	2026-04-04 15:03:52.453	simple	f
cmnlbcgbs000fxdgtjgigsopy	cmmyjcyvf000440c7xv6t3akr	55.00	PENDING	\N	2026-04-05 05:20:50.344	2026-04-05 05:20:50.344	simple	f
cmnld4jig0001q0vbspwunjcp	cmmyjcyvf000440c7xv6t3akr	34.00	PENDING	\N	2026-04-05 06:10:40.456	2026-04-05 06:10:40.456	simple	f
cmnqgx4ha0004wpja0d6b44g9	cmnqgw8vs0002wpjaj6a4r0tr	51.00	PENDING	\N	2026-04-08 19:55:43.726	2026-04-08 19:55:43.726	simple	f
cmnqgyxqn0008wpjabj5j4vdw	cmnqgw8vs0002wpjaj6a4r0tr	75.00	PENDING	\N	2026-04-08 19:57:08.303	2026-04-08 19:57:08.303	simple	f
cmnsy81wd0005uiz6ldfjwbpp	cmmyjcyvf000440c7xv6t3akr	18.00	PENDING	\N	2026-04-10 13:35:39.421	2026-04-10 13:35:39.421	simple	f
cmnszhx1j0001tr2asooz7egh	cmmyjcyvf000440c7xv6t3akr	31.50	PENDING	\N	2026-04-10 14:11:19.304	2026-04-10 14:11:19.304	simple	f
cmnut12wt0001i1daopz3otgp	cmntc7ysm0002qqonk85um1nl	21.44	PENDING	\N	2026-04-11 20:45:48.413	2026-04-11 20:45:48.413	fast	t
cmnx6hcc50001rumva1lf8v2w	cmnqgw8vs0002wpjaj6a4r0tr	34.08	PENDING	\N	2026-04-13 12:37:54.486	2026-04-13 12:37:54.486	fast	t
cmnx6hms50005rumvnrgqjz5x	cmnqgw8vs0002wpjaj6a4r0tr	21.44	PENDING	\N	2026-04-13 12:38:08.021	2026-04-13 12:38:08.021	fast	t
cmnx7hrd5000arumvjh0maqe1	cmnx7h7sm0008rumv6f166caz	34.08	PENDING	\N	2026-04-13 13:06:13.577	2026-04-13 13:06:13.577	fast	t
cmo1m8w5s0001ywffjznw3yzz	cmmyjcyvf000440c7xv6t3akr	84.11	PENDING	\N	2026-04-16 15:10:18.829	2026-04-16 15:10:18.829	fast	t
cmo1msub20005ywff8n5k21kf	cmmyjcyvf000440c7xv6t3akr	20.34	DELIVERED	\N	2026-04-16 15:25:49.55	2026-04-16 20:26:16.512	fast	t
cmo1xtnj30005138qv549znzg	cmmyjcyvf000440c7xv6t3akr	52.37	PENDING	\N	2026-04-16 20:34:23.199	2026-04-16 20:34:23.199	fast	t
cmo8v8kjj0002oakax7ohgciv	cmmyjcyvf000440c7xv6t3akr	101.74	SHIPPED	\N	2026-04-21 16:56:23.55	2026-04-21 16:56:54.816	simple	f
cmoafbc8l00028h7jjbzwbcu9	cmmyjcyvf000440c7xv6t3akr	84.11	PENDING	\N	2026-04-22 19:06:11.252	2026-04-22 19:06:11.252	fast	t
cmoafbp7l00078h7jwlsxx8yc	cmmyjcyvf000440c7xv6t3akr	18.00	PENDING	\N	2026-04-22 19:06:28.065	2026-04-22 19:06:28.065	simple	f
\.


--
-- Data for Name: OrderLine; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."OrderLine" (id, "orderId", "productId", qty, "unitPrice", options) FROM stdin;
cmn03vo900005p3fvoxhf3557	cmn03vo8z0003p3fv6hhuyjzl	cmmxhqnlr0001tcacoxizwb0v	1	12.00	{}
cmn03vo900006p3fvfug4iwdq	cmn03vo8z0003p3fv6hhuyjzl	prd-009	1	15.00	{}
cmn03xi3f000ap3fvbupounnv	cmn03xi3f0008p3fvxyyv473b	cmmxhqnlr0001tcacoxizwb0v	1	12.00	{}
cmn04a1ir000gp3fvuagge2hg	cmn04a1ir000ep3fvp0i3885z	cmmxhqnlr0001tcacoxizwb0v	1	12.00	{}
cmn04a1ir000hp3fv5srw28d7	cmn04a1ir000ep3fvp0i3885z	prd-009	1	15.00	{}
cmn04f9860003pbt7oacb956o	cmn04f9860001pbt7xqfplyqb	cmmxhqnlr0001tcacoxizwb0v	1	12.00	{}
cmn1bx5bw0003pfim5ya963jy	cmn1bx5bw0001pfim71oeeizv	cmmxhqnlr0001tcacoxizwb0v	1	12.00	{}
cmn643kta0003ugprykf2daxr	cmn643kt90001ugpr8fncet3u	prd-009	1	15.00	{}
cmn91mfxm00054qlz25mh9jg6	cmn91mfxm00034qlzcmy3lagi	cmmxhqnlr0001tcacoxizwb0v	2	12.00	{}
cmn91mfxm00064qlzt7yqhyoa	cmn91mfxm00034qlzcmy3lagi	prd-005	1	18.50	{}
cmnbiiofc0003k5asbmcduf6m	cmnbiiofc0001k5asysrkscd6	cmmxhqnlr0001tcacoxizwb0v	1	12.00	{}
cmnbiiofc0004k5aslqlnsio9	cmnbiiofc0001k5asysrkscd6	prd-005	3	18.50	{}
cmnixasae0002bsf727ajywg6	ord-001	prd-001	1	24.99	{}
cmnixasae0003bsf7u81y2iox	ord-001	prd-003	2	12.99	{}
cmnixasat0005bsf7d6ipul7h	ord-002	prd-002	1	89.99	{}
cmnixasax0007bsf7y2m0ap4j	ord-003	prd-004	2	24.99	{}
cmnixasax0008bsf7wg12vnwf	ord-003	prd-005	1	18.50	{}
cmnixasax0009bsf7q35g8imk	ord-003	prd-009	3	15.00	{}
cmnixasb1000bbsf7mxf8fwxn	ord-004	prd-006	2	9.99	{}
cmnixasb6000dbsf7kk87tpuj	ord-005	prd-007	1	34.99	{}
cmnixasb6000ebsf7ob4al36t	ord-005	prd-010	1	59.99	{}
cmnixasba000gbsf7l3or9wmi	ord-006	prd-008	1	79.99	{}
cmnixasbd000ibsf740de0v3v	ord-007	prd-001	2	24.99	{}
cmnixasbd000jbsf7r9a7a8jp	ord-007	prd-004	1	24.99	{}
cmnj1hfe90003b1bl74s60lpv	cmnj1hfe80001b1bldc35g9di	cmng4akb000015zyzlfs7bhts	1	12.00	{}
cmnj1hfe90004b1blfomrql0g	cmnj1hfe80001b1bldc35g9di	cmniz413r0003t28x3tfeled6	2	55.00	{}
cmnkeisbc00039j0tjtzbj3b6	cmnkeisbc00019j0t30s20t9j	cmniz413r0003t28x3tfeled6	1	55.00	{}
cmnkfbtqu0003xdgtwjmrma3l	cmnkfbtqu0001xdgtrzaes1rn	cmniz413r0003t28x3tfeled6	2	55.00	{}
cmnkfnlx10007xdgtg57veyji	cmnkfnlx10005xdgtw87ojf5d	cmniz413r0003t28x3tfeled6	2	55.00	{}
cmnkgqe11000dxdgtwhrab5ql	cmnkgqe11000bxdgtcg5imtq3	cmniz413r0003t28x3tfeled6	2	55.00	{}
cmnlbcgbs000hxdgtkz013dvg	cmnlbcgbs000fxdgtjgigsopy	cmniz413r0003t28x3tfeled6	1	55.00	{}
cmnld4jig0003q0vbq6k67ei6	cmnld4jig0001q0vbspwunjcp	cmnlbtc7p000jxdgt44yt6zgd	1	34.00	{"54a2e44d-590c-4985-ab59-daf83e088896": "54", "70e1932f-8419-42bc-994a-4b75b0ae615c": "S", "dd93b518-5a55-4939-b6e2-761723889aea": "Ak"}
cmnqgx4ha0006wpjaah3thn2o	cmnqgx4ha0004wpja0d6b44g9	cmnlbtc7p000jxdgt44yt6zgd	1	51.00	{"54a2e44d-590c-4985-ab59-daf83e088896": "43", "70e1932f-8419-42bc-994a-4b75b0ae615c": "XS", "dd93b518-5a55-4939-b6e2-761723889aea": "Akat"}
cmnqgyxqn000awpja9w7k52pj	cmnqgyxqn0008wpjabj5j4vdw	cmnq8e4of0005oo8cgbjsd0mm	1	75.00	{}
cmnsy81wd0007uiz6gw15odyh	cmnsy81wd0005uiz6ldfjwbpp	cmnsccxps00034ei1hssff5a0	1	18.00	{}
cmnszhx1k0003tr2a0fuckse5	cmnszhx1j0001tr2asooz7egh	cmnsvp4y30003uiz65kos1f8m	1	31.50	{"0663acd2-d6e6-4eb1-86a5-62bc3598fa5c": "Ak"}
cmnut12wt0003i1dajgpale18	cmnut12wt0001i1daopz3otgp	cmnsccxps00034ei1hssff5a0	1	18.00	{}
cmnx6hcc50003rumv9vn4fxpz	cmnx6hcc50001rumva1lf8v2w	cmnsvp4y30003uiz65kos1f8m	1	31.50	{"0663acd2-d6e6-4eb1-86a5-62bc3598fa5c": "Gyzyl"}
cmnx6hms50007rumv2595q1sr	cmnx6hms50005rumvnrgqjz5x	cmnsccxps00034ei1hssff5a0	1	18.00	{}
cmnx7hrd5000crumv99k5kbc1	cmnx7hrd5000arumvjh0maqe1	cmnsvp4y30003uiz65kos1f8m	1	31.50	{"0663acd2-d6e6-4eb1-86a5-62bc3598fa5c": "Ýaşil"}
cmo1m8w5t0003ywff9n22siy4	cmo1m8w5s0001ywffjznw3yzz	cmniz413r0003t28x3tfeled6	1	82.50	{"1f973290-cf9c-4112-9cd7-d4ca67c9f9f0": "L", "bc56268c-d6f5-4e82-a6aa-35dc9a613387": "23", "bfb655ea-2c79-4c25-895a-1ce6f67008d2": "Gök"}
cmo1msub20007ywffrbv096t1	cmo1msub20005ywff8n5k21kf	cmmxhqnlr0001tcacoxizwb0v	1	18.00	{}
cmo1xtnj30007138qzi43xtd0	cmo1xtnj30005138qv549znzg	cmnlbtc7p000jxdgt44yt6zgd	1	51.00	{"54a2e44d-590c-4985-ab59-daf83e088896": "21", "70e1932f-8419-42bc-994a-4b75b0ae615c": "S", "dd93b518-5a55-4939-b6e2-761723889aea": "Gyzyl"}
cmo8v8kjj0004oakaip4czvk7	cmo8v8kjj0002oakax7ohgciv	cmo4d4y6y0003cz6ft6f8x0k4	1	82.50	{"4db6b7b1-614b-43ab-bc22-3fab0b17750f": "21"}
cmo8v8kjj0005oaka3oxf05xb	cmo8v8kjj0002oakax7ohgciv	cmmxhqnlr0001tcacoxizwb0v	1	18.00	{}
cmoafbc8m00048h7j75rrwmly	cmoafbc8l00028h7jjbzwbcu9	cmo4d4y6y0003cz6ft6f8x0k4	1	82.50	{"4db6b7b1-614b-43ab-bc22-3fab0b17750f": "23"}
cmoafbp7l00098h7jg0p027km	cmoafbp7l00078h7jwlsxx8yc	cmo77zwxv0001enfuuqjrmt8j	1	18.00	{}
\.


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."Product" (id, "nameTk", "nameRu", "categoryId", image, price, stock, sold, status, "createdAt", "updatedAt", "imageUrl", "weightG", options, "imageUrls", markup, "descriptionRu", "descriptionTk") FROM stdin;
prd-003	Göçme Zarýadlaýjy	Портативная зарядка	cat-2	🔋	12.99	105	461	ACTIVE	2026-03-12 13:51:55.711	2026-03-12 13:51:55.711	\N	\N	[]	{}	50	\N	\N
prd-006	Akylly Lampochka	Умная лампочка	cat-5	💡	9.99	8	92	ACTIVE	2026-03-12 13:51:55.712	2026-03-12 13:51:55.712	\N	\N	[]	{}	50	\N	\N
prd-010	Mehaniki Klawiatura	Механическая клавиатура	cat-1	🎮	59.99	5	41	ARCHIVED	2026-03-12 13:51:55.715	2026-03-12 15:30:16.017	\N	\N	[]	{}	50	\N	\N
prd-001	Simsiz Gulaklyk Pro	Наушники Pro	cat-1	🎧	24.99	42	284	ACTIVE	2026-03-12 13:51:55.711	2026-03-12 13:51:55.711	\N	\N	[]	{}	50	\N	\N
prd-002	Akylly Sagat Series 3	Умные часы Series 3	cat-1	⌚	89.99	18	173	ACTIVE	2026-03-12 13:51:55.711	2026-03-12 13:51:55.711	\N	\N	[]	{}	50	\N	\N
prd-004	Bluetooth Dinamigi	Bluetooth-колонка	cat-1	🔊	24.99	67	198	ACTIVE	2026-03-12 13:51:55.711	2026-03-12 13:51:55.711	\N	\N	[]	{}	50	\N	\N
prd-005	Kamera Çantasy	Сумка для камеры	cat-3	🎒	18.50	89	134	ACTIVE	2026-03-12 13:51:55.711	2026-03-12 13:51:55.711	\N	\N	[]	{}	50	\N	\N
prd-007	USB-C Hub 7-in-1	USB-C Hub 7-в-1	cat-2	🔌	34.99	0	57	ACTIVE	2026-03-12 13:51:55.713	2026-03-12 13:51:55.713	\N	\N	[]	{}	50	\N	\N
prd-008	Sport Köwüş Nike	Кроссовки Nike	cat-3	👟	79.99	34	210	DRAFT	2026-03-12 13:51:55.713	2026-03-12 13:51:55.713	\N	\N	[]	{}	50	\N	\N
prd-009	Ýüz Kremi	Крем для лица	cat-4	🧴	15.00	55	88	ACTIVE	2026-03-12 13:51:55.714	2026-03-12 13:51:55.714	\N	\N	[]	{}	50	\N	\N
cmmp2vmn20003pgmvku737f3a	lk	klj	cat-2	📦	55.00	0	0	ACTIVE	2026-03-13 15:55:10.814	2026-03-13 15:55:33.159	\N	\N	[]	{}	50	\N	\N
cmmp33qti00059bd6tigml08f	bro	bro	cat-2	📦	55.00	0	0	DRAFT	2026-03-13 16:01:29.477	2026-03-14 19:57:31.911	\N	\N	[]	{}	50	\N	\N
cmnsccxps00034ei1hssff5a0	wsq	wsq	cat-3	📦	12.00	12	0	ACTIVE	2026-04-10 03:23:35.714	2026-04-10 03:23:35.714	https://res.cloudinary.com/dlphot301/image/upload/v1775784130/silkshop/products/jzfrqpgtmwc6fg6hcnnr.png	222	[]	{https://res.cloudinary.com/dlphot301/image/upload/v1775784130/silkshop/products/jzfrqpgtmwc6fg6hcnnr.png,https://res.cloudinary.com/dlphot301/image/upload/v1775784131/silkshop/products/vx4ozbgvxckep53aeylj.png}	50	\N	\N
cmmrezgki00053t5pd5gnz9y4	23	32	cat-2	📦	32.00	0	0	ACTIVE	2026-03-15 07:09:37.313	2026-03-15 07:09:37.313	\N	\N	[]	{}	50	\N	\N
cmmtc0f3g0003xie5f50g78s2	edw	dewref	cat-2	📦	12.00	0	0	ACTIVE	2026-03-16 15:21:55.564	2026-03-16 15:38:56.251	https://res.cloudinary.com/dlphot301/image/upload/v1773668299/silkshop/products/bvxygyqer0tuvlnkwcsy.jpg	222	[]	{}	50	\N	\N
cmmwbo8ee0003d8omuluph03e	ds	asd	cat-2	📦	12.00	0	0	ACTIVE	2026-03-18 17:35:45.542	2026-03-18 17:35:45.542	\N	222	[]	{}	50	\N	\N
cmng4akb000015zyzlfs7bhts	dqw	qdw	cat-2	📦	12.00	23	0	ACTIVE	2026-04-01 14:04:33.992	2026-04-01 14:05:18.929	https://res.cloudinary.com/dlphot301/image/upload/v1775045005/silkshop/products/ifyj8ypvevpml814kpqw.png	\N	[]	{}	50	\N	\N
cmnsvp4y30003uiz65kos1f8m	wqd	wqd	cat-3	📦	21.00	21	0	ACTIVE	2026-04-10 12:24:57.675	2026-04-10 12:24:57.675	https://res.cloudinary.com/dlphot301/image/upload/v1775816611/silkshop/products/u28vioj23raudr7q1oxl.png	144	[{"id": "0663acd2-d6e6-4eb1-86a5-62bc3598fa5c", "type": "select", "nameRu": "Цвет", "nameTk": "Reňk", "values": ["Akat", "Ak", "Gyzyl", "Gök", "Ýaşil", "Sary", "Gülgün", "Çal"], "required": true}]	{https://res.cloudinary.com/dlphot301/image/upload/v1775816611/silkshop/products/u28vioj23raudr7q1oxl.png,https://res.cloudinary.com/dlphot301/image/upload/v1775816611/silkshop/products/plkqmmplj6fcwjkx8hau.png}	50	\N	\N
cmnx9aem8000135w97boss11i	ewfe	efw	cat-3	📦	23.00	21	0	ACTIVE	2026-04-13 13:56:29.696	2026-04-13 13:56:29.696	\N	233	[{"id": "91e8f62b-e3c8-4185-bfeb-9430aaab7b19", "type": "select", "nameRu": "Цвет", "nameTk": "Reňk", "values": ["Akat", "Ak", "Gyzyl", "Gök", "Ýaşil", "Sary", "Gülgün", "Çal"], "required": true}]	{}	50	few	few
cmniz413r0003t28x3tfeled6	test	test	cat-3	📦	55.00	55	0	ACTIVE	2026-04-03 14:02:49.623	2026-04-03 15:12:39.959	https://res.cloudinary.com/dlphot301/image/upload/v1775217697/silkshop/products/ncy61cbbkhilsmqaq86c.png	55	[{"id": "bfb655ea-2c79-4c25-895a-1ce6f67008d2", "type": "select", "nameRu": "Цвет", "nameTk": "Reňk", "values": ["Akat", "Ak", "Gyzyl", "Gök", "Ýaşil", "Sary", "Gülgün", "Çal"], "required": true}, {"id": "1f973290-cf9c-4112-9cd7-d4ca67c9f9f0", "type": "select", "nameRu": "Размер", "nameTk": "Ölçeg", "values": ["XS", "S", "M", "L", "XL", "XXL"], "required": true}, {"id": "bc56268c-d6f5-4e82-a6aa-35dc9a613387", "type": "number", "unit": "EU", "nameRu": "Размер", "nameTk": "Ölçeg", "values": [], "required": true}]	{}	50	\N	\N
cmnlbtc7p000jxdgt44yt6zgd	wqd	qdw	cat-3	📦	34.00	45	0	ACTIVE	2026-04-05 05:33:58.166	2026-04-05 05:33:58.166	https://res.cloudinary.com/dlphot301/image/upload/v1775359962/silkshop/products/krnxqsxanoz5nbd89fgj.png	34	[{"id": "54a2e44d-590c-4985-ab59-daf83e088896", "type": "number", "unit": "EU", "nameRu": "Размер", "nameTk": "Ölçeg", "values": [], "required": true}, {"id": "70e1932f-8419-42bc-994a-4b75b0ae615c", "type": "select", "nameRu": "Размер", "nameTk": "Ölçeg", "values": ["XS", "S", "M", "L", "XL", "XXL"], "required": true}, {"id": "dd93b518-5a55-4939-b6e2-761723889aea", "type": "select", "nameRu": "Цвет", "nameTk": "Reňk", "values": ["Akat", "Ak", "Gyzyl", "Gök", "Ýaşil", "Sary", "Gülgün", "Çal"], "required": true}]	{}	50	\N	\N
cmnq8dc8n0003oo8c320vwpxt	wq	wqd	cat-3	📦	20.00	20	0	DRAFT	2026-04-08 15:56:23.729	2026-04-08 15:56:23.729	https://res.cloudinary.com/dlphot301/image/upload/v1775656502/silkshop/products/myhwemk5tq5lk54wadvs.png	22	[]	{}	50	\N	\N
cmnq8e4of0005oo8cgbjsd0mm	wdq	dqw	cat-3	📦	50.00	23	0	ACTIVE	2026-04-08 15:57:00.591	2026-04-08 19:56:13.9	https://res.cloudinary.com/dlphot301/image/upload/v1775656539/silkshop/products/z8fi9fwr4rqv2hkejxyp.png	500	[]	{}	50	\N	\N
cmo79jlw90005enfuj2x0is3u	weeds	sdsdds	cmo79isjm0003enfuus7uborg	📦	45.00	43	0	ACTIVE	2026-04-20 14:01:20.793	2026-04-20 14:01:20.793	https://res.cloudinary.com/dlphot301/image/upload/v1776686376/silkshop/products/euwpgslarfmkjotsfeym.png	3443	[]	{https://res.cloudinary.com/dlphot301/image/upload/v1776686376/silkshop/products/euwpgslarfmkjotsfeym.png}	50	\N	\N
cmo77zwxv0001enfuuqjrmt8j	test esik	test esik	cmo4d3lqr0001cz6fcyy0gga0	📦	12.00	0	1	ACTIVE	2026-04-20 13:18:02.371	2026-04-22 19:06:28.071	https://res.cloudinary.com/dlphot301/image/upload/v1776683777/silkshop/products/fu3qwsiq5qjewuyvcw3k.png	\N	[]	{https://res.cloudinary.com/dlphot301/image/upload/v1776683777/silkshop/products/fu3qwsiq5qjewuyvcw3k.png}	50	\N	\N
cmmxhqnlr0001tcacoxizwb0v	das	dea	cat-3	📦	12.00	11	1	ACTIVE	2026-03-19 13:13:22.431	2026-04-21 16:56:23.583	https://res.cloudinary.com/dlphot301/image/upload/v1773918758/silkshop/products/kezxl6jiedgpnlp1tcfd.jpg	122	[]	{}	50	\N	\N
cmo4d4y6y0003cz6ft6f8x0k4	salam	salam	cmo4d3lqr0001cz6fcyy0gga0	📦	55.00	53	2	ACTIVE	2026-04-18 13:18:36.826	2026-04-22 19:06:11.291	https://res.cloudinary.com/dlphot301/image/upload/v1776511016/silkshop/products/pafdeilvrhtadpi26dsl.jpg	55	[{"id": "4db6b7b1-614b-43ab-bc22-3fab0b17750f", "type": "number", "unit": "EU", "nameRu": "Размер", "nameTk": "Ölçeg", "values": [], "required": true}]	{https://res.cloudinary.com/dlphot301/image/upload/v1776511016/silkshop/products/pafdeilvrhtadpi26dsl.jpg}	50	salam	salam
\.


--
-- Data for Name: ProductRequest; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."ProductRequest" (id, "nameTk", "nameRu", description, "imageUrl", "contactName", "contactPhone", "contactEmail", status, "adminNote", "createdAt", "updatedAt") FROM stdin;
cmn0ehyj70000zlm9phv31906	dgd	dg	gd	\N	dg	+99362160072	babanazarjumadurdyyev@gmail.com	SEEN	\N	2026-03-21 14:05:56.349	2026-03-21 14:06:06.644
cmn0emy1y00001imq51g2wdez	adec	acs	gdac	\N	dg	+99362160072	babanazarjumadurdyyev@gmail.com	SEEN	\N	2026-03-21 14:09:49.03	2026-03-21 14:09:55.223
cmn0eqoyv0000u7dzux19kcvh	asd	acs	acs	https://res.cloudinary.com/dlphot301/image/upload/v1774095116/silkshop/requests/qa0izq2puxdrmb53wwzy.jpg	acs	+99362160072	babanazarjumadurdyyev@gmail.com	SEEN	\N	2026-03-21 14:12:43.879	2026-03-21 14:12:49.313
cmo8vaggt0006oakam9nz6ubu	qwd	qdwwq	ddqw	https://res.cloudinary.com/dlphot301/image/upload/v1776783364/silkshop/requests/dfygapezmuve7ni9cgqq.png	wdq	+99362160072	babanazarjumadurdyyev@gmail.com	SEEN	\N	2026-04-21 16:57:51.581	2026-04-21 16:58:02.304
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."RefreshToken" (id, token, "userId", "expiresAt", "createdAt") FROM stdin;
cmmukkepb0003k2sakpmod6xu	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzczNzQ5MzUxLCJleHAiOjE3NzQzNTQxNTF9.aygdBEXerSSQtfPdFjPItl0aVNyf1JYPYPZcbg5LTrk	cmmnj19pq0000cu087d2c669b	2026-03-24 12:09:11.279	2026-03-17 12:09:11.28
cmmurzt2s0001gyessheohci1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzczNzYxODI3LCJleHAiOjE3NzQzNjY2Mjd9.9cAiGRStGhkkKhRKs5qY5SGc0EJnoYiNdt7RbD-ZMnI	cmmnj19pq0000cu087d2c669b	2026-03-24 15:37:07.039	2026-03-17 15:37:07.055
cmmuuzrxt0001ce3obtvwloda	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzczNzY2ODY0LCJleHAiOjE3NzQzNzE2NjR9.ok0RdYyN30UPSPhjZHU8_AfvYoqxmdwo_eEIJ-CNxxg	cmmnj19pq0000cu087d2c669b	2026-03-24 17:01:04.431	2026-03-17 17:01:04.433
cmmwbkh7p0001d8omzmhjdw6b	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzczODU1MTcwLCJleHAiOjE3NzQ0NTk5NzB9.m36zElSlJZt30PSbqeNeCroAzBTlMZcgplZQfjyeuwU	cmmnj19pq0000cu087d2c669b	2026-03-25 17:32:50.336	2026-03-18 17:32:50.338
cmn0avnvg00012akfahcs7ffq	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc0MDk1ODc3LCJleHAiOjIwODk2NzE4Nzd9.MnEAgR3piCfPcsxyPWu_2XqFc4YQl7zsR02yUQ4456Y	cmmnj19pq0000cu087d2c669b	2026-03-28 12:24:37.275	2026-03-21 12:24:37.276
cmn0bve7y0001rmczeeyhnunr	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc0MDk3NTQ0LCJleHAiOjIwODk2NzM1NDR9.RPtzOjuRydcYKr7LeREf4uEg1sXgU4sdOY2g2I-wW_M	cmmnj19pq0000cu087d2c669b	2026-03-28 12:52:24.38	2026-03-21 12:52:24.382
cmn7lh6y00001rl87skcoaevz	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc0NTM2OTQxLCJleHAiOjIwOTAxMTI5NDF9.TtL-T2TGAE3nz9afb6pfkypunOpPEi7nNWIBRiAuRVU	cmmnj19pq0000cu087d2c669b	2026-04-02 14:55:41.154	2026-03-26 14:55:41.157
cmn90elgf00014qlzjg9eyxim	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc0NjIyNDgwLCJleHAiOjIwOTAxOTg0ODB9._YF_Eatl-hxeqklJuO8h1t0abNfG3OFJ42MUpUwz4fw	cmmnj19pq0000cu087d2c669b	2026-04-03 14:41:20.397	2026-03-27 14:41:20.412
cmnbcec4w00014iqqqlttyq9z	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc0NzYzNTU1LCJleHAiOjIwOTAzMzk1NTV9.06AQm3uKElIVv295DszOPMxE6tCXT5dYjVcbYiDULBc	cmmnj19pq0000cu087d2c669b	2026-04-05 05:52:35.577	2026-03-29 05:52:36.059
cmniz10a60001t28x8wi9eibc	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1MjI0ODI4LCJleHAiOjIwOTA4MDA4Mjh9.LLMKjbtt3YSQrzoLHbLqKKIRE2riPonythrmdJJEMKo	cmmnj19pq0000cu087d2c669b	2026-04-10 14:00:28.588	2026-04-03 14:00:28.59
cmnj0t3rp00013x2ag6rkqs5i	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1MjI3ODE5LCJleHAiOjIwOTA4MDM4MTl9.lDl8WEuzS4X-ApSdbeV7GavtLWmwREq5ZZ4o56sIojM	cmmnj19pq0000cu087d2c669b	2026-04-10 14:50:19.084	2026-04-03 14:50:19.087
cmnj0vsf60001ekp43hjssbp3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1MjI3OTQ0LCJleHAiOjIwOTA4MDM5NDR9.t1Wx56kQ8he6h7nw7b9Jkpin2efEHVULVTPFdPXdabU	cmmnj19pq0000cu087d2c669b	2026-04-10 14:52:24.352	2026-04-03 14:52:24.353
cmnkg9b330009xdgt5h55ho6h	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1MzE0MjM1LCJleHAiOjIwOTA4OTAyMzV9.mtzLsqBmspgGStNupygkNvQYmFhE-Ur6bcJMXTN_cZs	cmmnj19pq0000cu087d2c669b	2026-04-11 14:50:35.485	2026-04-04 14:50:35.487
cmnn95iyc0001k5t1249hx4lm	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1NDgzNzAwLCJleHAiOjIwOTEwNTk3MDB9.tnQvC_vgVY47Xi8Ji7Lc729sruTbsPWxpVWe_JfcPnk	cmmnj19pq0000cu087d2c669b	2026-04-13 13:55:00.271	2026-04-06 13:55:00.273
cmnolnhy80001jfgaju901cok	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1NTY1MTYwLCJleHAiOjIwOTExNDExNjB9.z9UgA6uZFTX2hKLO8i5WppUgpn0oMvJtiusIOvBHR5s	cmmnj19pq0000cu087d2c669b	2026-04-14 12:32:40.348	2026-04-07 12:32:40.351
cmnosbh6y0001oo8cbeaz8qis	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1NTc2MzU2LCJleHAiOjIwOTExNTIzNTZ9.dOz0_6bxnPfxZU-LvH7GaIes37GvyJI1dWqds7h-VEU	cmmnj19pq0000cu087d2c669b	2026-04-14 15:39:16.81	2026-04-07 15:39:16.811
cmnqelvy00001ptncsn1g4zr5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1Njc0MjYwLCJleHAiOjIwOTEyNTAyNjB9.NzHqw4P4LWqKIAp6ViTkZwqA91qKXqnLxJCCVCdiiF8	cmmnj19pq0000cu087d2c669b	2026-04-15 18:51:00.213	2026-04-08 18:51:00.215
cmnqgceuh0001wpjag929u23j	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1Njc3MTc3LCJleHAiOjIwOTEyNTMxNzd9.3PO1hxd8TOB_HQGI31DD65r9YhTtkSfEzkdxJmdkAEI	cmmnj19pq0000cu087d2c669b	2026-04-15 19:39:37.383	2026-04-08 19:39:37.385
cmnsb9nup00011rg544pesoag	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1Nzg5NTgzLCJleHAiOjIwOTEzNjU1ODN9.ZOVRamfuOjB7fDUKB9dOCfGKZv8tpRhy5omsDNKkeok	cmmnj19pq0000cu087d2c669b	2026-04-17 02:53:03.351	2026-04-10 02:53:03.354
cmnscbnsk00014ei1v17yv0jl	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1NzkxMzU2LCJleHAiOjIwOTEzNjczNTZ9.QxyeF9_nGIiXHvB1oIDkZat4my4GfgfselrY0maFp6Q	cmmnj19pq0000cu087d2c669b	2026-04-17 03:22:36.21	2026-04-10 03:22:36.212
cmnsvg24y0001uiz6mawznp59	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1ODIzNDc0LCJleHAiOjIwOTEzOTk0NzR9.oOHJktvTys1G9ZWIpIG13ySxfAJOMwgM72Orf9B4ggo	cmmnj19pq0000cu087d2c669b	2026-04-17 12:17:54.116	2026-04-10 12:17:54.13
cmntbgu2k0001qqonm92hb1m0	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc1ODUwMzg0LCJleHAiOjIwOTE0MjYzODR9.ARwHrofqwRZd56A-cEryYBYepHLprrXOMFSjy2_BaqM	cmmnj19pq0000cu087d2c669b	2026-04-17 19:46:24.184	2026-04-10 19:46:24.188
cmnx4ly0m0001e7awm5rc5ky1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc2MDgwNzI5LCJleHAiOjIwOTE2NTY3Mjl9.LA2jJipHRsMc71t-5qVewbWFgTVQ_eVoguDFgqN0AfI	cmmnj19pq0000cu087d2c669b	2026-04-20 11:45:29.957	2026-04-13 11:45:29.969
cmo1xg1xz0001138q0qt8gqok	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc2MzcxMDI4LCJleHAiOjIwOTE5NDcwMjh9.OihSujd7i1CjIcQ6XCcJORzuQrwKvCKizSr7N9HKmrw	cmmnj19pq0000cu087d2c669b	2026-04-23 20:23:48.691	2026-04-16 20:23:48.692
cmo32tdv40003x4hvo26unn14	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW1uajE5cHEwMDAwY3UwODdkMmM2NjliIiwiZW1haWwiOiJhZG1pbkBzaWxrc2hvcC50bSIsInJvbGUiOiJBRE1JTiIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzc2NDQwNTE0LCJleHAiOjIwOTIwMTY1MTR9.eIVaOr_k5ijSZK0yyj_MEAcHPe6aXFZ6Hte_9iU6UqI	cmmnj19pq0000cu087d2c669b	2026-04-24 15:41:54.924	2026-04-17 15:41:54.928
\.


--
-- Data for Name: StoreSettings; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."StoreSettings" (id, "nameTk", "nameRu", "taglineTk", "taglineRu", email, phone, "addressTk", "addressRu", currency, logo, "updatedAt") FROM stdin;
singleton	SilkShop	SilkShop	Iň gowy önümler	Лучшие товары	info@silkshop.tm	+993 12 123456	Aşgabat, Türkmenistan	Ашхабад, Туркменистан	TMT	🛍️	2026-03-16 20:18:28.71
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: silkshop_user
--

COPY public."User" (id, name, email, "passwordHash", role, avatar, phone, timezone, "langPref", "createdAt", "updatedAt") FROM stdin;
cmmnj19pq0000cu087d2c669b	Admin	admin@silkshop.tm	$2b$10$Pl1q3k8W1u1uQz0Sjt22P.gP/KXTBOnz.4J.uMuhgh4XQOdNcUMvm	ADMIN	👨‍💼	\N	Asia/Ashgabat	tk	2026-03-12 13:51:55.502	2026-04-20 13:13:57.249
\.


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: OrderLine OrderLine_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."OrderLine"
    ADD CONSTRAINT "OrderLine_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: ProductRequest ProductRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."ProductRequest"
    ADD CONSTRAINT "ProductRequest_pkey" PRIMARY KEY (id);


--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: StoreSettings StoreSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."StoreSettings"
    ADD CONSTRAINT "StoreSettings_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Category_parentId_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Category_parentId_idx" ON public."Category" USING btree ("parentId");


--
-- Name: Comment_customerId_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Comment_customerId_idx" ON public."Comment" USING btree ("customerId");


--
-- Name: Comment_productId_createdAt_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Comment_productId_createdAt_idx" ON public."Comment" USING btree ("productId", "createdAt" DESC);


--
-- Name: Customer_createdAt_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Customer_createdAt_idx" ON public."Customer" USING btree ("createdAt" DESC);


--
-- Name: Customer_email_key; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE UNIQUE INDEX "Customer_email_key" ON public."Customer" USING btree (email);


--
-- Name: Customer_googleId_key; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE UNIQUE INDEX "Customer_googleId_key" ON public."Customer" USING btree ("googleId");


--
-- Name: Customer_status_createdAt_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Customer_status_createdAt_idx" ON public."Customer" USING btree (status, "createdAt" DESC);


--
-- Name: OrderLine_orderId_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "OrderLine_orderId_idx" ON public."OrderLine" USING btree ("orderId");


--
-- Name: OrderLine_productId_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "OrderLine_productId_idx" ON public."OrderLine" USING btree ("productId");


--
-- Name: Order_createdAt_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Order_createdAt_idx" ON public."Order" USING btree ("createdAt" DESC);


--
-- Name: Order_customerId_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Order_customerId_idx" ON public."Order" USING btree ("customerId");


--
-- Name: Order_customerId_status_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Order_customerId_status_idx" ON public."Order" USING btree ("customerId", status);


--
-- Name: Order_status_createdAt_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Order_status_createdAt_idx" ON public."Order" USING btree (status, "createdAt" DESC);


--
-- Name: Order_status_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Order_status_idx" ON public."Order" USING btree (status);


--
-- Name: ProductRequest_status_createdAt_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "ProductRequest_status_createdAt_idx" ON public."ProductRequest" USING btree (status, "createdAt" DESC);


--
-- Name: Product_categoryId_status_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Product_categoryId_status_idx" ON public."Product" USING btree ("categoryId", status);


--
-- Name: Product_status_createdAt_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Product_status_createdAt_idx" ON public."Product" USING btree (status, "createdAt" DESC);


--
-- Name: Product_status_price_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Product_status_price_idx" ON public."Product" USING btree (status, price);


--
-- Name: Product_status_sold_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "Product_status_sold_idx" ON public."Product" USING btree (status, sold DESC);


--
-- Name: RefreshToken_token_key; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE UNIQUE INDEX "RefreshToken_token_key" ON public."RefreshToken" USING btree (token);


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: silkshop_user
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Category Category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comment Comment_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderLine OrderLine_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."OrderLine"
    ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderLine OrderLine_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."OrderLine"
    ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Order Order_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: silkshop_user
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict FJow4HnDKz5K1yJycSy94qtLOI5T5L34Ia4vy8SHVtXIGRpBnxoDZE2TLOOgLVo

