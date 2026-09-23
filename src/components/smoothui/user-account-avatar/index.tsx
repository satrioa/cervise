"use client";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TrashIcon, UploadIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export interface UserData {
  avatar: string;
  email: string;
  name: string;
}

export interface Order {
  date: string;
  id: string;
  progress: number;
  status: "processing" | "shipped" | "delivered";
}

export interface UserAccountAvatarProps {
  className?: string;
  inline?: boolean;
  onOrderView?: (orderId: string) => void;
  onProfileSave?: (user: UserData) => void;
  onLogoUpload?: (file: File) => void;
  onLogoRemove?: () => void;
  orders?: Order[];
  user: UserData;
}

export default function UserAccountAvatar({
  user,
  onLogoUpload,
  onLogoRemove,
  className = "",
}: UserAccountAvatarProps) {
  const [userData, setUserData] = useState<UserData>(user);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUserData(user);
  }, [user]);

  const handleUploadClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUserData((prev) => ({ ...prev, avatar: url }));
    onLogoUpload?.(file);
    // reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemove = () => {
    setUserData((prev) => ({ ...prev, avatar: "" }));
    onLogoRemove?.();
  };

  const hasAvatar = !!userData.avatar;

  return (
    <Popover>
      <PopoverTrigger render={<button className={`flex cursor-pointer items-center gap-2 rounded-full border bg-background ${className}`} type="button" />}>
        <img
          alt="User Avatar"
          className="rounded-full object-cover"
          draggable={false}
          height={48}
          width={48}
          src={userData.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.name)}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 overflow-hidden rounded-xl border bg-background p-1 shadow-xl" sideOffset={8} align="center">
        <div className="flex flex-col gap-1">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            <UploadIcon className="size-4 opacity-70" />
            Upload Logo
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={!hasAvatar}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            <TrashIcon className="size-4" />
            Hapus Logo
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
