import { Children, cloneElement, isValidElement } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";

const translatedProps = new Set(["aria-label", "body", "k", "label", "placeholder", "sub", "title", "v"]);

function localize(node, t) {
  if (typeof node === "string") return t(node);
  if (Array.isArray(node)) return node.map((child) => localize(child, t));
  if (!isValidElement(node)) return node;

  const props = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (translatedProps.has(key) && typeof value === "string") props[key] = t(value);
  }
  if ("children" in node.props) props.children = Children.map(node.props.children, (child) => localize(child, t));
  return cloneElement(node, props);
}

export default function Localized({ children }) {
  const { t } = useLanguage();
  return localize(children, t);
}
