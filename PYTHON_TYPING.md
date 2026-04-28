# Python Typing Rules

All Python code in this project must remain compatible with Pylance and Pyright strict mode.

- Add type annotations for function arguments and return values.
- Avoid implicit `Any`; when unknown data is unavoidable, narrow it at the boundary.
- Use typed containers from `typing` where they improve Pyright compatibility: `List`, `Dict`, `Tuple`, `Optional`, `Any`, `Union`, and `Iterable`.
- Prefer `row.get("field")` for dynamic CSV/dataframe-derived rows, or explicitly type the row as `Dict[str, Any]`.
- Handle `None` before using values in string, numeric, datetime, or dataframe operations.
- Type CSV readers as `Iterable[Dict[str, str]]`.
- Convert values explicitly before numeric operations with `float(...)` or `int(...)`.
- Do not mix string and numeric values in calculations.
- Avoid `cast(Any, value)` and broad suppressions; fix the type at the source unless there is no practical alternative.

Validation before commit:

```bash
python3 -m py_compile $(git ls-files '*.py')
npx pyright . --pythonpath .venv/bin/python --warnings
```
