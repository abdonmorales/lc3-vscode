;
; Example: Multiply a number by 6 using repeated addition
; (from Patt & Patel, Figure 7.1)
;
; Before execution, store an integer in NUMBER.
;
.ORIG x3050

        LD   R1, SIX       ; R1 ← 6 (loop counter)
        LD   R2, NUMBER     ; R2 ← the integer to multiply
        AND  R3, R3, #0     ; Clear R3 — it will hold the product

; ── Inner loop: add NUMBER to itself SIX times ──
;
AGAIN   ADD  R3, R3, R2     ; product += number
        ADD  R1, R1, #-1    ; decrement counter
        BRp  AGAIN          ; loop while R1 > 0

        ST   R3, RESULT     ; store final product

        HALT                ; done

; ── Data Section ──
NUMBER  .BLKW 1             ; input value (set before running)
SIX     .FILL x0006         ; constant 6
RESULT  .BLKW 1             ; output: NUMBER * 6

.END
