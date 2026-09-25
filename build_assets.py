# Bu araç @keyiflerolsun tarafından | @KekikAkademi için yazılmıştır.

from CLI        import konsol
from pathlib    import Path
from rich.table import Table
from rich.panel import Panel
from rich       import box
import re, subprocess, shutil, base64, random


# ═══════════════════════════════════════════════════════════════════════════
# esbuild tabanlı minify & bundle
# JS  : gerçek ESM bundling (circular import'larda live-binding) + identifier mangling
# CSS : @import inline + minify
# Node/npm gerekmez — esbuild statik Go binary'si (Dockerfile'da PATH'e kurulur).
# ═══════════════════════════════════════════════════════════════════════════

ESBUILD = shutil.which("esbuild") or "esbuild"


# ═══════════════════════════════════════════════════════════════════════════
# Kozmetik string gizleme (esbuild sadece identifier mangle eder, string
# literal'lere dokunmaz — "sidebar", API path'leri vs. düz metin kalır).
# Gerçek güvenlik değil (devtools'tan decode fonksiyonu çağrılabilir); amaç
# view-source/grep ile magic string aramayı zorlaştırmak.
#
# ponytail: build başına rastgele XOR key + helper adı — tek regex'le tüm
# projede toplu deşifre yapılamasın diye. Template literal ve regex literal
# içerikleri atlanır (kapsam küçük tutuldu, asıl risk düz "..."/'...' string'lerde).
# Escape'li string'ler ('\n', '\"' vs. içerenler) de atlanır — basit/güvenli kalsın.
# ═══════════════════════════════════════════════════════════════════════════

_REGEX_KEYWORDS = frozenset((
    "return", "case", "typeof", "instanceof", "in", "delete",
    "void", "throw", "new", "yield", "await", "else"
))


def _is_regex_start(code: str, i: int) -> bool:
    if i == 0:
        return True
    k = i - 1
    while k >= 0 and code[k] in " \t\n\r":
        k -= 1
    if k < 0:
        return True
    prev = code[k]
    if prev in ")]}" or prev.isdigit():
        return False
    if prev.isalpha() or prev in "_$":
        end = k + 1
        while k >= 0 and (code[k].isalnum() or code[k] in "_$"):
            k -= 1
        return code[k + 1 : end] in _REGEX_KEYWORDS
    return True


def _skip_regex(code: str, i: int) -> int:
    n = len(code)
    j = i + 1
    while j < n:
        c = code[j]
        if c == "\\" and j + 1 < n:
            j += 2
            continue
        if c == "/":
            j += 1
            while j < n and code[j].isalpha():
                j += 1
            return j
        if c == "[":
            j += 1
            while j < n and code[j] != "]":
                if code[j] == "\\" and j + 1 < n:
                    j += 1
                j += 1
            j += 1
            continue
        j += 1
    return n


def _skip_brace_expr(code: str, start: int, depth: int) -> int:
    n = len(code)
    j = start
    while j < n and depth > 0:
        c = code[j]
        if c == "{":
            depth += 1; j += 1
        elif c == "}":
            depth -= 1; j += 1
        elif c in ('"', "'"):
            j = _skip_string_raw(code, j)
        elif c == "`":
            j = _skip_template(code, j)
        elif c == "/" and j + 1 < n and _is_regex_start(code, j):
            j = _skip_regex(code, j)
        else:
            j += 1
    return j


def _skip_string_raw(code: str, i: int) -> int:
    n, quote, j = len(code), code[i], i + 1
    while j < n:
        if code[j] == "\\" and j + 1 < n:
            j += 2
            continue
        if code[j] == quote:
            return j + 1
        j += 1
    return n


def _skip_template(code: str, i: int) -> int:
    n, j = len(code), i + 1
    while j < n:
        c = code[j]
        if c == "\\" and j + 1 < n:
            j += 2
            continue
        if c == "`":
            return j + 1
        if c == "$" and j + 1 < n and code[j + 1] == "{":
            j = _skip_brace_expr(code, j + 2, 1)
            continue
        j += 1
    return n


def _collapse_template_ws(code: str) -> str:
    """
    Template literal içindeki whitespace'i tek boşluğa indirir, HTML tag'ler arası
    boşluğu tamamen siler (`>  <` → `><`) — çok satırlı template string'ler
    (innerHTML için yazılan chat.js/dialogs.js vb.) tek satıra iner. `${}` içindeki
    kod dokunulmadan kalır (recursive — iç içe template literal'ler de kapsanır).
    """
    out: list[str] = []
    i, n           = 0, len(code)

    while i < n:
        c = code[i]

        if c in ('"', "'"):
            j = _skip_string_raw(code, i)
            out.append(code[i:j]); i = j
            continue

        if c == "/" and i + 1 < n and code[i + 1] not in ("/", "*") and _is_regex_start(code, i):
            j = _skip_regex(code, i)
            out.append(code[i:j]); i = j
            continue

        if c == "`":
            j, raw_parts, is_html = i + 1, ["`"], False
            while j < n:
                tc = code[j]
                if tc == "\\" and j + 1 < n:
                    raw_parts.append(code[j : j + 2]); j += 2
                    continue
                if tc == "`":
                    raw_parts.append("`"); j += 1
                    break
                if tc == "$" and j + 1 < n and code[j + 1] == "{":
                    end  = _skip_brace_expr(code, j + 2, 1)
                    expr = code[j + 2 : end - 1]
                    raw_parts.append("${" + _collapse_template_ws(expr) + "}")
                    j = end
                    continue
                if tc == "<":
                    is_html = True
                raw_parts.append(tc); j += 1
            template = "".join(raw_parts)
            # Sadece HTML üreten (innerHTML) template'lerde whitespace'i sıkıştır —
            # düz veri string'leri ("\n\n" gibi ayraçlar) olduğu gibi korunur.
            if is_html:
                template = re.sub(r"[ \t\n\r]+", " ", template)
                template = re.sub(r">\s+<", "><", template)
            out.append(template)
            i = j
            continue

        out.append(c); i += 1

    return "".join(out)


def _make_string_encoder() -> tuple:
    key  = random.randint(1, 255)
    name = "_" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz", k=6))

    def encode(raw: str) -> str:
        xored = bytes(b ^ key for b in raw.encode("utf-8"))
        b64   = base64.b64encode(xored).decode("ascii")
        return f'{name}("{b64}")'

    helper = f'function {name}(s){{s=atob(s);let r="";for(let i=0;i<s.length;i++)r+=String.fromCharCode(s.charCodeAt(i)^{key});return r}};'
    return encode, helper


def _obfuscate_strings(code: str) -> str:
    encode, helper = _make_string_encoder()
    out: list[str] = []
    tail = ""   # son ~12 karakter — "import(" tespiti + token bitişme kontrolü için
    i, n           = 0, len(code)

    def _emit(s: str) -> None:
        nonlocal tail
        out.append(s)
        tail = (tail + s)[-12:]

    while i < n:
        c = code[i]

        if c == "`":
            j = _skip_template(code, i)
            _emit(code[i:j]); i = j
            continue

        if c == "/" and i + 1 < n and code[i + 1] not in ("/", "*") and _is_regex_start(code, i):
            j = _skip_regex(code, i)
            _emit(code[i:j]); i = j
            continue

        if c in ('"', "'"):
            probe = tail.rstrip()
            if probe.endswith("("):
                probe = probe[:-1].rstrip()
            if probe.endswith(("from", "import")):
                # module specifier: from"x", import"x" (side-effect), import("x") (dinamik)
                j = _skip_string_raw(code, i)
                _emit(code[i:j]); i = j
                continue

            quote, j, has_escape = c, i + 1, False
            while j < n:
                sc = code[j]
                if sc == "\\" and j + 1 < n:
                    has_escape = True; j += 2
                    continue
                if sc == quote:
                    break
                j += 1

            if has_escape or j >= n:
                _emit(code[i : j + 1])
            else:
                prev      = tail.rstrip()
                prev_char = prev[-1] if prev else ""

                # object/destructuring key ise ({"a":1 ya da ,"a":1) düz çağrı geçersiz
                # syntax olur — computed key syntax'a çevir: {[fn(...)]:1}
                look = j + 1
                while look < n and code[look] in " \t\n\r":
                    look += 1
                is_key = prev_char in "{," and look < n and code[look] == ":"

                encoded = encode(code[i + 1 : j])
                if is_key:
                    encoded = f"[{encoded}]"

                # önceki token bir keyword/identifier ise (case"x" gibi) araya boşluk
                # koy — yoksa helper çağrısı önceki kelimeyle birleşip tek identifier olur.
                sep = " " if prev_char and (prev_char.isalnum() or prev_char in "_$") else ""
                _emit(sep + encoded)
            i = j + 1
            continue

        _emit(c); i += 1

    return helper + "".join(out)

# Kaynak kök: Public/ (standart) veya Web/ (BuddyTelegram) — otomatik algılanır.
ROOT = "Web" if Path("Web").is_dir() else "Public"

# JS entry-point adları: Static/JS/ altında bu adlı kaynak dosya + yerel import varsa
# ESM bundle'a çevrilir (<ad>.min.js). Diğer .js dosyaları sadece minify edilir,
# import'ları native ESM olarak tarayıcıda (sibling .min.js dosyalarından) çözülür.
JS_ENTRY_NAMES = ("main", "discover")


def _esbuild(args: list[str]) -> tuple[bool, str]:
    try:
        result = subprocess.run([ESBUILD, *args], capture_output=True, text=True, timeout=60)
        return result.returncode == 0, (result.stderr or result.stdout).strip()
    except FileNotFoundError:
        return False, "esbuild bulunamadı (PATH'e kurulu değil)"
    except Exception as e:
        return False, str(e)


def _is_js_entry(js_file: Path, text: str) -> bool:
    return (
        js_file.parent.name.lower() == "js"
        and js_file.stem in JS_ENTRY_NAMES
        and bool(re.search(r"^\s*import\b[^\n]*\bfrom\s+['\"]\.", text, re.M))
    )


def _is_css_entry(css_file: Path, text: str) -> bool:
    if css_file.parent.name.lower() != "css":
        return False
    imports = re.findall(r"@import\s+url\(['\"]?([^'\")]+)['\"]?\)", text)
    return any(not i.startswith(("http://", "https://")) for i in imports)


def minify_assets():
    minified_count = 0
    results        = []

    for css_file in sorted(Path(ROOT).rglob("*.css")):
        if css_file.name.endswith(".min.css"):
            continue
        original = css_file.read_text("utf-8")
        min_file = css_file.with_name(f"{css_file.stem}.min.css")
        ok, err  = _esbuild([str(css_file), "--minify", f"--outfile={min_file}"])
        if not ok:
            konsol.log(f"[red]✗ CSS minify hatası[/] ({css_file}): {err}")
            continue
        orig_size = len(original.encode())
        mini_size = min_file.stat().st_size
        results.append({
            "type"      : "[cyan]CSS[/]",
            "file"      : str(css_file),
            "original"  : f"{orig_size:,} B",
            "minified"  : f"{mini_size:,} B",
            "reduction" : f"[green]{((orig_size - mini_size) / orig_size * 100):.1f}%[/]" if orig_size else "0.0%",
        })
        minified_count += 1

    for js_file in sorted(Path(ROOT).rglob("*.js")):
        if js_file.name.endswith(".min.js"):
            continue
        original = js_file.read_text("utf-8")
        min_file = js_file.with_name(f"{js_file.stem}.min.js")
        ok, err  = _esbuild([str(js_file), "--minify", f"--outfile={min_file}"])
        if not ok:
            konsol.log(f"[red]✗ JS minify hatası[/] ({js_file}): {err}")
            continue
        transformed = _obfuscate_strings(_collapse_template_ws(min_file.read_text("utf-8")))
        min_file.write_text(transformed, "utf-8")
        orig_size = len(original.encode())
        mini_size = min_file.stat().st_size
        results.append({
            "type"      : "[yellow]JS[/]",
            "file"      : str(js_file),
            "original"  : f"{orig_size:,} B",
            "minified"  : f"{mini_size:,} B",
            "reduction" : f"[green]{((orig_size - mini_size) / orig_size * 100):.1f}%[/]" if orig_size else "0.0%",
        })
        minified_count += 1

    if not results:
        konsol.log("[bold yellow]ℹ Minify edilecek dosya yok[/]\n")
        return

    table = Table(
        title        = "[yellow]🔨 Asset Minification[/] [magenta]:rocket:[/]",
        box          = box.SIMPLE_HEAVY,
        show_header  = True,
        show_lines   = False,
        header_style = "bold magenta",
        padding      = (0, 1),
        pad_edge     = False,
    )
    table.add_column("Tip",      no_wrap=True)
    table.add_column("Dosya",    style="white")
    table.add_column("Orijinal", style="yellow",  justify="right")
    table.add_column("Minified", style="magenta", justify="right")
    table.add_column("Azalma",   justify="right")

    for r in results:
        table.add_row(r["type"], r["file"], r["original"], r["minified"], r["reduction"])

    toplam_orig = sum(int(r["original"].replace(" B", "").replace(",", "")) for r in results)
    toplam_mini = sum(int(r["minified"].replace(" B", "").replace(",", "")) for r in results)
    table.add_row(
        "",
        "[bold]Toplam[/]",
        f"[bold yellow]{toplam_orig / 1024:.2f} KB[/]",
        f"[bold magenta]{toplam_mini / 1024:.2f} KB[/]",
        f"[bold green]{(toplam_orig - toplam_mini) / toplam_orig * 100:.1f}%[/]" if toplam_orig else "0.0%",
    )
    table.caption = f"[bold green]✓ {minified_count} dosya minify edildi[/]"

    konsol.print(Panel.fit(
        renderable   = table,
        box          = box.ROUNDED,
        title        = "[bold cyan]📦 Minification Raporu[/]",
        border_style = "cyan",
        padding      = (0, 0),
    ))


def bundle_css_file(css_root: Path, entry_filename: str, output_filename: str) -> bool:
    entry_file = css_root / entry_filename

    if not entry_file.exists():
        konsol.log(f"[yellow]⚠ {entry_filename} bulunamadı, bundle atlandı.[/]")
        return False

    out_path = css_root / output_filename
    ok, err  = _esbuild([str(entry_file), "--bundle", "--minify", f"--outfile={out_path}"])
    if not ok:
        konsol.log(f"[red]✗ CSS bundle hatası[/]: {err}")
        return False

    konsol.log(f"[green]✓ CSS bundle:[/] {out_path}")
    return True


def bundle_js_file(js_root: Path, entry_filename: str, output_filename: str) -> bool:
    entry_file = js_root / entry_filename

    if not entry_file.exists():
        konsol.log(f"[yellow]⚠ {entry_filename} bulunamadı, bundle atlandı.[/]")
        return False

    out_path = js_root / output_filename
    ok, err  = _esbuild([str(entry_file), "--bundle", "--minify", "--format=iife", f"--outfile={out_path}"])
    if not ok:
        konsol.log(f"[red]✗ JS bundle hatası[/]: {err}")
        return False

    transformed = _obfuscate_strings(_collapse_template_ws(out_path.read_text("utf-8")))
    out_path.write_text(transformed, "utf-8")
    konsol.log(f"[green]✓ JS bundle:[/] {out_path}")
    return True


def _auto_bundle_css():
    """Static/CSS/ altında yerel @import içeren her kaynak .css → <ad>.bundle.min.css."""
    for css_file in sorted(Path(ROOT).rglob("*.css")):
        if ".min." in css_file.name:
            continue
        if not _is_css_entry(css_file, css_file.read_text("utf-8")):
            continue
        bundle_css_file(css_file.parent, css_file.name, f"{css_file.stem}.bundle.min.css")


def _auto_bundle_js():
    """Static/JS/<JS_ENTRY_NAMES>.js (yerel import içeren kaynak) → <ad>.min.js ESM bundle."""
    for js_file in sorted(Path(ROOT).rglob("*.js")):
        if ".min." in js_file.name:
            continue
        if not _is_js_entry(js_file, js_file.read_text("utf-8")):
            continue
        bundle_js_file(js_file.parent, js_file.name, f"{js_file.stem}.min.js")


def build_assets():
    minify_assets()
    _auto_bundle_css()
    _auto_bundle_js()


if __name__ == "__main__":
    build_assets()
