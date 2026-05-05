import { Link } from "@tanstack/react-router";

import UserMenu from "./user-menu";

// アプリ上部の共通ヘッダーです。
// links 配列を増やすと、ナビゲーション項目も同じ形で増やせます。
export default function Header() {
  const links = [
    { to: "/", label: "Home" },
  ] as const;

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          {links.map(({ to, label }) => {
            return (
              // TanStack Router の Link は、クリック時にページ全体を再読み込みせず画面遷移します。
              <Link key={to} to={to}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
