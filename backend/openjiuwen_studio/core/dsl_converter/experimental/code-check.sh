#!/usr/bin/env bash
# =============================================================================
# code-check.sh  —  Check Python files against Huawei coding rules
#
# Usage:
#   ./code-check.sh              # check git-staged files (pre-commit mode)
#   ./code-check.sh file.py ...  # check specific files
#
# Rules checked:
#   G.NAM.01  Variable/function name does not conform to snake_case style
#   G.FNM.03  Too many function arguments (>5)
#   G.CLS.07  Method does not use self/cls -> add @staticmethod/@classmethod
#   G.CLS.08  Class attribute defined outside __init__
#   G.CLS.11  Access to protected member outside class hierarchy
#             (includes self._parent_method() in subclasses — not caught by pylint)
#   G.FMT.02  Line too long (>120 characters)
#   G.FMT.03  Classes separated by fewer than 2 blank lines
#   G.FMT.04  Multiple spaces after ':' or before an operator
#   G.FMT.07  Import order: stdlib -> third-party -> local
#   G.VAR.03  Redefining name from outer scope
#   G.NAM.02  Bad single-character variable name (l, I, o)
#   G.PSL.02  datetime.now() called without explicit tz argument
#   G.LOG.02  Use logging module instead of print()
#
# Exit codes:
#   0  no violations found
#   1  one or more violations found
#   2  required tool not found
# =============================================================================

set -uo pipefail

# -- Colours ------------------------------------------------------------------
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# -- Helper: require a CLI tool -----------------------------------------------
require_tool() {
    local cmd="$1" pkg="$2"
    if ! command -v "$cmd" &>/dev/null; then
        echo -e "${RED}ERROR:${RESET} '$cmd' not found. Install with:  pip install ${pkg}"
        exit 2
    fi
}

require_tool pylint  pylint
require_tool python3 python3

# -- Resolve target files -----------------------------------------------------
if [[ $# -gt 0 ]]; then
    mapfile -t FILES < <(printf '%s\n' "$@" | grep '\.py$')
else
    mapfile -t FILES < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep '\.py$')
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "No Python files to check."
    exit 0
fi

echo -e "${BOLD}Checking ${#FILES[@]} file(s) against Huawei coding rules...${RESET}"
echo "--------------------------------------------------------------------"

# Counter file (tee-based counting does not work with subshells)
ISSUE_COUNT=0

emit() {
    # emit FILE LINE RULE DESCRIPTION DETAIL
    echo -e "${CYAN}${1}:${2}${RESET} ${YELLOW}[${3}]${RESET} ${4}"
    echo -e "   detail: ${5}"
    ISSUE_COUNT=$(( ISSUE_COUNT + 1 ))
}

# =============================================================================
# PART 1 -- pylint  (G.FNM.03, G.CLS.11, G.FMT.02, G.FMT.07, G.VAR.03)
# =============================================================================

declare -A RULE_MAP=(
    ["invalid-name"]="G.NAM.01|Name does not conform to snake_case naming style"
    ["too-many-arguments"]="G.FNM.03|Too many arguments (>5) - encapsulate with dataclass or namedtuple"
    ["attribute-defined-outside-init"]="G.CLS.08|Class instance attribute defined outside __init__ — move it into __init__"
    ["protected-access"]="G.CLS.11|Access to protected member outside class hierarchy"
    ["line-too-long"]="G.FMT.02|Line too long (>120 characters)"
    ["wrong-import-order"]="G.FMT.07|Wrong import order (expected: stdlib -> third-party -> local)"
    ["ungrouped-imports"]="G.FMT.07|Imports from the same package should be grouped together"
    ["wrong-import-position"]="G.FMT.07|Import should be placed at the top of the module"
    ["redefined-outer-name"]="G.VAR.03|Redefining name from outer scope - do not shadow identifiers from an outer scope"
)

ENABLED_MSGS=$(IFS=,; echo "${!RULE_MAP[*]}")

while IFS= read -r issue; do
    [[ -z "$issue" ]] && continue
    file=$(   echo "$issue" | cut -d: -f1)
    lineno=$( echo "$issue" | cut -d: -f2)
    symbol=$( echo "$issue" | cut -d: -f3)
    msg=$(    echo "$issue" | cut -d: -f4-)
    entry="${RULE_MAP[$symbol]:-}"
    [[ -z "$entry" ]] && continue
    emit "$file" "$lineno" "${entry%%|*}" "${entry##*|}" "$msg"
done < <(
    pylint \
        --disable=all \
        --enable="${ENABLED_MSGS}" \
        --max-line-length=120 \
        --max-args=5 \
        --variable-rgx='[a-z_][a-z0-9_]*$' \
        --argument-rgx='[a-z_][a-z0-9_]*$' \
        --attr-rgx='[a-z_][a-z0-9_]*$' \
        --function-rgx='[a-z_][a-z0-9_]*$' \
        --method-rgx='[a-z_][a-z0-9_]*$' \
        --msg-template="{path}:{line}:{symbol}:{msg}" \
        --score=no \
        "${FILES[@]}" 2>/dev/null \
    | grep -E '^[^:]+:[0-9]+:[a-z]' || true
)

# =============================================================================
# =============================================================================
# PART 2 -- G.CLS.07: method never uses self/cls
#   (pylint 3+ removed no-self-use; we check via AST)
# =============================================================================

while IFS='|' read -r file lineno fqn first_arg; do
    emit "$file" "$lineno" \
        "G.CLS.07" \
        "Method does not use self/cls - add @staticmethod or @classmethod" \
        "method '${fqn}' never uses '${first_arg}'"
done < <(
python3 - "${FILES[@]}" <<'PYEOF'
import ast, sys

for filepath in sys.argv[1:]:
    try:
        tree = ast.parse(open(filepath, encoding="utf-8").read(), filename=filepath)
    except (OSError, SyntaxError):
        continue

    for cls_node in ast.walk(tree):
        if not isinstance(cls_node, ast.ClassDef):
            continue
        for node in cls_node.body:
            if not isinstance(node, ast.FunctionDef):
                continue
            dec_names = {
                (d.id if isinstance(d, ast.Name) else
                 d.attr if isinstance(d, ast.Attribute) else "")
                for d in node.decorator_list
            }
            if dec_names & {"staticmethod", "classmethod"}:
                continue
            all_args = node.args.args
            if not all_args:
                continue
            first_arg = all_args[0].arg
            if first_arg not in ("self", "cls"):
                continue
            used = any(
                isinstance(n, ast.Name) and n.id == first_arg
                for n in ast.walk(node) if n is not node
            )
            if not used:
                print(f"{filepath}|{node.lineno}|{cls_node.name}.{node.name}|{first_arg}")
PYEOF
)

# =============================================================================
# PART 2b -- G.CLS.11 (extended): self._parent_method() in subclass
#   pylint only flags  other_obj._x  (external access).
#   The Huawei rule also forbids  self._x()  when  _x  is defined on a parent
#   class, not on the current class itself.  We detect this with an AST check:
#   if self._name is called but _name is not defined anywhere in this class,
#   it must come from a parent — which is a G.CLS.11 violation.
# =============================================================================

while IFS='|' read -r file lineno fqn attr_name; do
    emit "$file" "$lineno" \
        "G.CLS.11" \
        "Access to parent-class protected member via self — expose via a public method instead" \
        "'${fqn}' calls self.${attr_name} but ${attr_name} is not defined in this class (inherited protected member)"
done < <(
python3 - "${FILES[@]}" <<'PYEOF'
import ast, sys

for filepath in sys.argv[1:]:
    try:
        tree = ast.parse(open(filepath, encoding="utf-8").read(), filename=filepath)
    except (OSError, SyntaxError):
        continue

    for cls_node in ast.walk(tree):
        if not isinstance(cls_node, ast.ClassDef):
            continue
        # All method names defined directly in THIS class (not inherited)
        local_names = {
            item.name for item in cls_node.body
            if isinstance(item, ast.FunctionDef)
        }
        for method in cls_node.body:
            if not isinstance(method, ast.FunctionDef):
                continue
            for node in ast.walk(method):
                if not isinstance(node, ast.Attribute):
                    continue
                attr_name = node.attr
                # Single-underscore protected only (skip __dunder__)
                if not attr_name.startswith("_") or attr_name.startswith("__"):
                    continue
                # Must be accessed on self
                if not (isinstance(node.value, ast.Name) and node.value.id == "self"):
                    continue
                # Violation: _name is not defined locally → must be inherited
                if attr_name not in local_names:
                    print(f"{filepath}|{node.end_lineno}|{cls_node.name}.{method.name}|{attr_name}")
PYEOF
)

# PART 3 -- G.LOG.02: print() instead of logging
# =============================================================================

for filepath in "${FILES[@]}"; do
    [[ ! -f "$filepath" ]] && continue
    while IFS=: read -r lineno match; do
        stripped="${match#"${match%%[![:space:]]*}"}"
        [[ "$stripped" == \#* ]] && continue
        emit "$filepath" "$lineno" \
            "G.LOG.02" \
            "Use the logging module instead of print()" \
            "${match}"
    done < <(grep -n 'print(' "$filepath" 2>/dev/null || true)
done

# =============================================================================
# PART 4 -- G.FMT.04: spacing violations around operators and colons
#   4a) Multiple spaces after ':'  (dict/annotation/slice padding)
#   4b) Multiple spaces before an operator  (alignment padding before = < > etc.)
#   Exempt from both: full-line comments, block-opening statements
# =============================================================================

for filepath in "${FILES[@]}"; do
    [[ ! -f "$filepath" ]] && continue

    # 4a) Multiple spaces after ':'
    while IFS=: read -r lineno match; do
        stripped="${match#"${match%%[![:space:]]*}"}"
        [[ -z "$stripped" || "$stripped" == \#* ]] && continue
        if echo "$stripped" | grep -qE '^\s*(def |class |if |elif |else:|for |while |with |try:|except|finally:)'; then
            continue
        fi
        emit "$filepath" "$lineno" \
            "G.FMT.04" \
            "Multiple spaces after ':' — use a single space to highlight keywords" \
            "${match}"
    done < <(grep -nP ':[[:space:]]{2,}' "$filepath" 2>/dev/null || true)

    # 4b) Multiple spaces before an operator (=, ==, !=, <=, >=, <, >, +=, -=, *=, /=)
    #     Strip inline comments first to avoid false positives in comment text
    while IFS=: read -r lineno match; do
        stripped="${match#"${match%%[![:space:]]*}"}"
        [[ -z "$stripped" || "$stripped" == \#* ]] && continue
        # Strip trailing inline comment before testing
        code_part=$(echo "$match" | sed 's/[[:space:]]*#.*$//')
        echo "$code_part" | grep -qP '\S[[:space:]]{2,}(?=[=!<>+\-*/%|&]{1,2})' || continue
        emit "$filepath" "$lineno" \
            "G.FMT.04" \
            "Multiple spaces before operator — use a single space around operators" \
            "${match}"
    done < <(grep -nP '\S[[:space:]]{2,}(?=[=!<>+\-*/%|&]{1,2})' "$filepath" 2>/dev/null || true)
done

# =============================================================================
# PART 5 -- G.FMT.03: expected 2 blank lines between top-level class definitions
#   PEP-8 / Huawei standard: top-level classes must be separated by 2 blank lines.
# =============================================================================

while IFS='|' read -r file lineno class_name blank_count; do
    emit "$file" "$lineno" \
        "G.FMT.03" \
        "Expected 2 blank lines before class definition, found ${blank_count}" \
        "class '${class_name}' is preceded by only ${blank_count} blank line(s) — add $((2 - blank_count)) more"
done < <(
python3 - "${FILES[@]}" <<'PYEOF'
import ast, sys

for filepath in sys.argv[1:]:
    try:
        src = open(filepath, encoding="utf-8").read()
        tree = ast.parse(src, filename=filepath)
    except (OSError, SyntaxError):
        continue
    lines = src.splitlines()
    # Only top-level classes (direct children of Module)
    for node in ast.iter_child_nodes(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        lineno = node.lineno
        if lineno <= 2:
            continue  # too close to file start to require 2 blank lines
        # Count consecutive blank lines immediately before this class
        blank = 0
        i = lineno - 2  # 0-indexed line just above the class def
        while i >= 0 and lines[i].strip() == '':
            blank += 1
            i -= 1
        if blank < 2:
            print(f"{filepath}|{lineno}|{node.name}|{blank}")
PYEOF
)

# =============================================================================
# PART 6 -- G.NAM.02: bad single-character variable names  l, I, o
#   These are visually ambiguous (l/I look like 1, o looks like 0).
#   Applies to: local variables, loop variables, comprehension targets.
# =============================================================================

while IFS='|' read -r file lineno var_name context; do
    emit "$file" "$lineno" \
        "G.NAM.02" \
        "Bad single-character variable name '${var_name}' — choose a descriptive name" \
        "${context}"
done < <(
python3 - "${FILES[@]}" <<'PYEOF'
import ast, sys

BAD = {'l', 'I', 'o'}

def check_target(node, filepath, context_prefix):
    if isinstance(node, ast.Name) and node.id in BAD:
        print(f"{filepath}|{node.lineno}|{node.id}|{context_prefix} '{node.id}'")
    elif isinstance(node, (ast.Tuple, ast.List)):
        for elt in node.elts:
            check_target(elt, filepath, context_prefix)

for filepath in sys.argv[1:]:
    try:
        tree = ast.parse(open(filepath, encoding="utf-8").read(), filename=filepath)
    except (OSError, SyntaxError):
        continue

    for node in ast.walk(tree):
        # Regular assignments: l = ..., o = ...
        if isinstance(node, ast.Assign):
            for target in node.targets:
                check_target(target, filepath, "variable assignment")
        # Annotated assignments: l: int = ...
        elif isinstance(node, ast.AnnAssign):
            check_target(node.target, filepath, "annotated assignment")
        # For loops: for l in ...
        elif isinstance(node, ast.For):
            check_target(node.target, filepath, "for-loop variable")
        # Comprehensions: [x for l in ...]
        elif isinstance(node, ast.comprehension):
            check_target(node.target, filepath, "comprehension variable")
        # With statements: with open() as l
        elif isinstance(node, ast.withitem) and node.optional_vars:
            check_target(node.optional_vars, filepath, "with-statement variable")
PYEOF
)

# =============================================================================
# PART 7 -- G.PSL.02: datetime.now() / datetime.datetime.now() without tz
#   Timezone-unaware datetime objects cause subtle bugs in multi-timezone systems.
#   Always pass an explicit tz= argument (e.g. tz=datetime.timezone.utc).
#   Flags: no tz argument at all, or tz=None (still unaware).
# =============================================================================

while IFS='|' read -r file lineno detail; do
    emit "$file" "$lineno" \
        "G.PSL.02" \
        "Timezone-unaware datetime — pass an explicit tz= argument (e.g. tz=datetime.timezone.utc)" \
        "${detail}"
done < <(
python3 - "${FILES[@]}" <<'PYEOF'
import ast, sys

for filepath in sys.argv[1:]:
    try:
        tree = ast.parse(open(filepath, encoding="utf-8").read(), filename=filepath)
    except (OSError, SyntaxError):
        continue

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr != 'now':
            continue
        obj = func.value
        # Match datetime.now() or datetime.datetime.now()
        is_dt_now = (
            (isinstance(obj, ast.Name) and obj.id == 'datetime') or
            (isinstance(obj, ast.Attribute) and obj.attr == 'datetime')
        )
        if not is_dt_now:
            continue

        # Find tz keyword
        tz_kw = next((kw for kw in node.keywords if kw.arg == 'tz'), None)
        has_positional_tz = len(node.args) > 0

        if tz_kw is None and not has_positional_tz:
            print(f"{filepath}|{node.end_lineno}|datetime.now() called without tz argument")
        elif tz_kw is not None:
            val = tz_kw.value
            if isinstance(val, ast.Constant) and val.value is None:
                print(f"{filepath}|{node.end_lineno}|datetime.now(tz=None) is still timezone-unaware")
PYEOF
)

# =============================================================================
# Summary
# =============================================================================

echo "--------------------------------------------------------------------"
if [[ "$ISSUE_COUNT" -eq 0 ]]; then
    echo -e "${BOLD}OK  No violations found.${RESET}"
    exit 0
else
    echo -e "${BOLD}${RED}FAIL  ${ISSUE_COUNT} violation(s) found.${RESET}"
    exit 1
fi