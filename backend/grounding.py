import re

# Fields whose text should appear on the page exactly as the model wrote it.
# Dates are skipped on purpose: the model may legitimately reformat them.
VERBATIM_FIELDS = {"name", "title", "email", "brand", "location", "organization", "role"}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def _digits(s: str) -> str:
    return re.sub(r"\D", "", s)


def check_grounding(data: dict, source: str) -> list[str]:
    """Return a list of reported values that do not appear in the source text."""
    src = _norm(source)
    src_digits = _digits(source)
    src_plain = source.replace(",", "")
    problems: list[str] = []

    def walk(node, key=""):
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, k)
        elif isinstance(node, list):
            for item in node:
                walk(item, key)
        elif isinstance(node, bool):
            return
        elif isinstance(node, str):
            if key in VERBATIM_FIELDS and _norm(node) not in src:
                problems.append(f"{key}: {node}")
            elif key == "phone":
                d = _digits(node)
                if len(d) >= 7 and d not in src_digits:
                    problems.append(f"{key}: {node}")
        elif isinstance(node, (int, float)) and key == "price":
            two = f"{node:.2f}"
            if two not in src_plain and two.rstrip("0").rstrip(".") not in src_plain:
                problems.append(f"{key}: {node}")

    walk(data)
    return problems