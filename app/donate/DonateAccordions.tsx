"use client";

import { ReactNode, useRef } from "react";

interface AccordionItem {
  id: string;
  heading: string;
  content: ReactNode;
}

export default function DonateAccordions({ items }: { items: AccordionItem[] }) {
  return (
    <>
      {items.map((item) => (
        <AccordionItem key={item.id} heading={item.heading}>
          {item.content}
        </AccordionItem>
      ))}
    </>
  );
}

function AccordionItem({ heading, children }: { heading: string; children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const item = wrapper.closest(".accordion-item") as HTMLElement;
    const isOpen = item?.classList.contains("accordion-open");
    if (isOpen) {
      wrapper.style.maxHeight = "0";
      item?.classList.remove("accordion-open");
    } else {
      wrapper.style.maxHeight = wrapper.scrollHeight + "px";
      item?.classList.add("accordion-open");
    }
  }

  return (
    <div className="accordion-item">
      <div className="accordion-title" onClick={toggle} style={{ cursor: "pointer" }}>
        <h6 className="accordion-heading">{heading}</h6>
        <img src="/images/Accordian-arrow.jpg" height={15} alt="" className="accordion-arrow" />
      </div>
      <div ref={wrapperRef} className="accordion-content-wrapper" style={{ maxHeight: 0, overflow: "hidden" }}>
        <div className="accordion-content">
          <div className="w-richtext">{children}</div>
        </div>
      </div>
    </div>
  );
}
