# Incident 03 - Al Noor fuel BR-CO-15

## Customer report

- Received: Monday 16 Nov 2026, 10:15 GST.
- Customer: Al Noor Fuel Trading.
- Symptom: several invoices rejected with BR-CO-15. Customer has audit concern.

## Runtime evidence

Invoice status query:

```text
ANF-2611-0041-GD2L | Accepted
ANF-2611-0042-GD2L | Rejected | asp | BR-CO-15 Got 15022.42 expected 15022.43
ANF-2611-0043-GD2L | Accepted
ANF-2611-0044-GD2L | Rejected | asp | BR-CO-15 Got 11817.57 expected 11817.59
ANF-2611-0045-GD2L | Accepted
ANF-2611-0046-GD2L | Rejected | asp | BR-CO-15 Got 5610.99 expected 5611.00
```

Workbook recalculation with decimal arithmetic:

```text
0042: net 14307.08 + vat 715.35 = 15022.43, app sent 15022.42
0044: net 11254.84 + vat 562.75 = 11817.59, app sent 11817.57
0046: net  5343.80 + vat 267.20 =  5611.00, app sent  5610.99
```

## Code evidence

`services/api/internal/pint/pint.go` builds monetary totals with inconsistent rounding:

```go
net += l.Quantity * l.UnitPrice
vat += l.Quantity * l.UnitPrice * (l.VATRate / 100)
gross += l.Quantity * l.UnitPrice * (1 + l.VATRate/100)
...
TaxExclusiveAmount: round2(net),
TaxAmount:          round2(vat),
TaxInclusiveAmount: round2(gross),
```

ASP validates tax inclusive amount as rounded tax exclusive amount plus rounded VAT. For fuel rows with 3-decimal unit prices, rounding gross directly can differ by 0.01 or 0.02.

## Assessment

Customer data appears internally consistent. The app is creating a PINT payload whose `TaxInclusiveAmount` does not equal `TaxExclusiveAmount + TaxAmount` after rounding. This should be treated as a product defect, not a customer template error.

Engineering fix: calculate inclusive totals from the rounded tax-exclusive and tax amount totals, or from rounded line extension/tax amounts using the same rounding model the ASP validates.
