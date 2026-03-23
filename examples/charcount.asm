;
; Example: Character counter
; Counts the number of occurrences of a character in a string.
; (Based on Patt & Patel, Section 5.5)
;
; 1. Prompts user for a character
; 2. Counts how many times it appears in the string
; 3. Displays the count as a digit (works for 0–9)
;
.ORIG x3000

; ── Prompt for character input ──
        LEA  R0, PROMPT     ; R0 ← address of prompt string
        PUTS                ; print prompt
        IN                  ; read character → R0 (with echo)

        LD   R1, NEWLINE
        ADD  R0, R0, #0     ; set CC for the character
        ST   R0, CHAR       ; save the input character

; ── Print newline ──
        ADD  R0, R1, #0     ; R0 ← newline
        OUT

; ── Initialize counter and pointer ──
        AND  R2, R2, #0     ; R2 = 0 (occurrence count)
        LEA  R3, STR        ; R3 → start of string
        LD   R4, CHAR       ; R4 = character to search for
        NOT  R4, R4
        ADD  R4, R4, #1     ; R4 = -CHAR (for comparison)

; ── Loop through each character ──
LOOP    LDR  R5, R3, #0     ; R5 = current string character
        BRz  DONE           ; null terminator → exit

        ADD  R6, R5, R4     ; R6 = current - target
        BRnp SKIP           ; not a match → skip
        ADD  R2, R2, #1     ; match found → count++

SKIP    ADD  R3, R3, #1     ; advance pointer
        BRnzp LOOP          ; continue

; ── Display the result ──
DONE    LD   R0, ASCII_0    ; R0 = '0'
        ADD  R0, R0, R2     ; R0 = '0' + count
        OUT                 ; display count digit

        ADD  R0, R1, #0     ; print final newline
        OUT

        HALT

; ── Data Section ──
PROMPT  .STRINGZ "Enter a character: "
STR     .STRINGZ "Hello, world!"
CHAR    .BLKW 1
ASCII_0 .FILL x0030         ; ASCII '0'
NEWLINE .FILL x000A         ; ASCII newline

.END
