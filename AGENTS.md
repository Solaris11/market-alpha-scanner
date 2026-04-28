# Repository Instructions

## Python Typing

All Python changes must remain compatible with Pylance and Pyright strict mode.

- Add explicit type annotations for function arguments and return values.
- Do not introduce implicit `Any`; narrow dynamic data at the boundary.
- Use `Optional[...]` or `| None` for nullable values and check for `None` before use.
- Type CSV readers as `Iterable[Dict[str, str]]`.
- Prefer `row.get("field")` for dynamic row data, or type rows as `Dict[str, Any]`.
- Convert values explicitly with `float(...)` or `int(...)` before numeric operations.
- Avoid `cast(Any, value)` and broad type suppressions unless there is no practical alternative.

Before committing Python changes, run:

```bash
python3 -m py_compile $(git ls-files '*.py')
npx pyright . --pythonpath .venv/bin/python --warnings
```
