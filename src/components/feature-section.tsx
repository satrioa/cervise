"use client";

import { cn } from "@/lib/utils";
import type React from "react";
import { motion } from "motion/react";
import { GridPattern } from "@/components/ui/grid-pattern";
import {
  BarChart3,
  LayoutDashboard,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

type FeatureType = {
	title: string;
	icon: React.ReactNode;
	description: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const gridVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
	hidden: { opacity: 0, y: 24 },
	show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export function FeatureSection() {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-8">
			<div className="mx-auto max-w-3xl text-center">
				<h2 className="font-heading text-balance font-medium text-2xl md:text-4xl lg:text-5xl">
					6 Menu Utama
				</h2>
				<p className="mt-4 text-balance text-muted-foreground text-sm md:text-base">
					Semua operasional toko gadget dalam satu aplikasi.
				</p>
			</div>

			<div className="overflow-hidden rounded-lg border">
				<motion.div
					variants={gridVariants}
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "-80px" }}
					className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 md:grid-cols-3"
				>
					{features.map((feature) => (
						<FeatureCard feature={feature} key={feature.title} />
					))}
				</motion.div>
			</div>
		</div>
	);
}

export function FeatureCard({
	feature,
	className,
	...props
}: React.ComponentProps<typeof motion.div> & {
	feature: FeatureType;
}) {
	return (
		<motion.div
			variants={cardVariants}
			className={cn("relative overflow-hidden bg-background p-6", className)}
			{...props}
		>
			<div className="mask-[radial-gradient(farthest-side_at_top,white,transparent)] pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 size-full">
				<GridPattern
					className="absolute inset-0 size-full stroke-foreground/20"
					height={40}
					width={40}
					x={20}
				/>
			</div>
			<div className="[&_svg]:size-6 [&_svg]:text-foreground/75">
				{feature.icon}
			</div>
			<h3 className="font-heading mt-10 text-sm md:text-base">{feature.title}</h3>
			<p className="relative z-20 mt-2 font-light text-muted-foreground text-xs">
				{feature.description}
			</p>
		</motion.div>
	);
}

const features: FeatureType[] = [
	{
		title: "Dashboard Overview",
		icon: <LayoutDashboard />,
		description: "Omzet, servis pending, dan workload teknisi per cabang.",
	},
	{
		title: "Servis",
		icon: <Wrench />,
		description: "7 status: Masuk → Diagnosa → Menunggu Konfirmasi → Sparepart → Dikerjakan → Selesai → Diambil. Garansi 3 bulan.",
	},
	{
		title: "Data Customer",
		icon: <Users />,
		description: "Riwayat servis per customer, notifikasi WhatsApp otomatis.",
	},
	{
		title: "Data Karyawan",
		icon: <UserCog />,
		description: "Master-admin, Admin, Frontliner, Teknisi — 1 user 1 cabang.",
	},
	{
		title: "Keuangan",
		icon: <Wallet />,
		description: "Kas harian, tutup kas, pemasukan & pengeluaran terpisah per cabang.",
	},
	{
		title: "Laporan",
		icon: <BarChart3 />,
		description: "Export Excel/PDF rentang tanggal, filter per teknisi & cabang.",
	},
];
