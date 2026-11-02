import React from "react";
import "./BottomNav.css";
import {
  LayoutDashboard,
  Radio,
  BookOpen,
  MessageSquare,
  User,
  Menu,
} from "lucide-react";

const BottomNav = ({ activePage, setActivePage, onOpenMenu, userRole }) => {
  const isStudent = userRole === "STUDENT";
  const isTutor = userRole === "TUTOR";

  const homePage = isStudent
    ? "student-dashboard"
    : isTutor
    ? "batch-dashboard"
    : "dashboard";

  const chatPage = isStudent
    ? "student-chatroom"
    : isTutor
    ? "tutor-chatroom"
    : "chat-room";

  const navItems = [
    {
      id: homePage,
      label: "Home",
      icon: LayoutDashboard,
      isActive:
        activePage === homePage ||
        activePage === "dashboard" ||
        activePage === "student-dashboard" ||
        activePage === "batch-dashboard",
    },
    {
      id: "live-class",
      label: "Classes",
      icon: Radio,
      isActive:
        activePage === "live-class" ||
        activePage === "class-scheduling" ||
        activePage === "class-details",
    },
    {
      id: "course-material",
      label: "Courses",
      icon: BookOpen,
      isActive:
        activePage === "course-material" ||
        activePage === "module" ||
        activePage === "project-kits",
    },
    {
      id: chatPage,
      label: "Chat",
      icon: MessageSquare,
      isActive:
        activePage === "chat-room" ||
        activePage === "student-chatroom" ||
        activePage === "tutor-chatroom",
    },
    {
      id: "menu",
      label: "Menu",
      icon: Menu,
      isAction: true,
      onClick: onOpenMenu,
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {navItems.map((item) => {
        const IconComponent = item.icon;
        const activeClass = item.isActive ? "active" : "";

        return (
          <button
            key={item.label}
            className={`bottom-nav-item ${activeClass}`}
            onClick={() => {
              if (item.isAction) {
                if (item.onClick) item.onClick();
              } else {
                setActivePage(item.id);
              }
            }}
            aria-label={item.label}
          >
            <div className="bottom-nav-icon-wrapper">
              <IconComponent size={20} />
              {item.isActive && <div className="bottom-nav-indicator" />}
            </div>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
