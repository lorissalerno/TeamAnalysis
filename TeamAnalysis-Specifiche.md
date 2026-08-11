# TeamAnalysis — Specifiche di Progetto

**Copyright / Autore**
- Sigla: taasalo3
- Nome: Loris Salerno
- Email: Loris.Salerno@swisscom.com
- Il codice deve includere funzioni/elementi personalizzati che riportano a questi dati come firma dell'autore, dato che il sito verrà condiviso come cartella HTML

## Descrizione generale

Applicazione web ad uso esclusivamente personale, pensata per funzionare interamente in locale su PC Windows.

**Vincoli tecnici:**
- Nessun linguaggio lato server (no PHP) e nessuna funzionalità che richieda permessi da amministratore, terminale o server esterni
- Sviluppo in HTML (con CSS/JS lato client)
- Nessuna condivisione o trasmissione di dati online: tutto deve restare sul PC dell'utente

## Sezioni dell'applicazione

### 1. Dashboard *(pagina iniziale del sito)*
- Vista d'insieme delle statistiche principali, di team o individuali
- Pulsante per configurare ogni box, scegliendo:
  - Tipo di statistica
  - Formato di visualizzazione (grafico o tabella)
  - Livello di dettaglio (team intero o singolo componente)
- I box devono poter essere riposizionati liberamente dall'utente (drag & drop)

### 2. Database
Divisa in due sotto-sezioni: **Performance** e **Sales**.
- Pulsante "Importa CSV" per importare i dati da file CSV in ciascuna sotto-sezione
- Prima importazione: CSV con i dati da gennaio a oggi
- Importazioni successive: alla richiesta di import, l'utente sceglie da un calendario la data di inizio da cui partono i nuovi dati del CSV; i dati dal quel giorno in poi vengono sostituiti completamente (i nuovi dati vengono aggiunti, quelli esistenti aggiornati, quelli non più presenti nel file vengono rimossi)
- Trovi 3 esempi di file csv performance, uno per team vas e due per team OP che hanno skill Wline e myservice
- Per il sales hai un file AOIT che sono i pacchetti singoli venduti e un file con i nuovi abonamenti internet, tv e mobile + i RET che sarebbero i rinnovi degli abonamenti internet tv e mobile.

### 3. Statistiche
Divisa in due sotto-sezioni: **Team** e **Individuale**.
- Pulsante per creare nuove tabelle e grafici
- Alla creazione, il sistema chiede quali dati del Database utilizzare (es. dati del team da gennaio a dicembre)
- L'utente sceglie liberamente quali statistiche mostrare in questa sezione
- Possibilità di affiancare il confronto con il relativo obiettivo
- Nella sotto-sezione **Individuale** si seleziona un singolo componente del team per vederne tutte le statistiche
- Possibilità di rinominare il titolo di ciascuna tabella/grafico
- Possibilità di esportare la sezione Statistiche in PDF e in Excel

### 4. Obiettivi
- Possibilità di impostare obiettivi di team e individuali
- Un obiettivo può essere definito per ciascuna statistica presente nel Database

## Funzionalità trasversali

### Modalità Nominativo / Anonimo
- Interruttore presente in tutte le sezioni, **eccetto** la sotto-sezione "Individuale" di Statistiche
- Alterna tra nomi reali dei componenti del team e numeri identificativi fissi (da 1 a 50)
- I numeri vengono assegnati e gestiti dal Database e possono cambiare da un anno all'altro, anche per lo stesso collaboratore

### Backup
- Tutti i dati sono salvati localmente nel browser
- Salvataggio di un backup completo dei dati in formato JSON
- Importazione/ripristino di un backup JSON salvato in precedenza
- Il sistema rileva le modifiche non ancora salvate e invita l'utente a effettuare un backup
- Se possibile, un popup alla chiusura della pagina chiede se salvare un backup prima di uscire

### Archiviazione annuale
- Ogni anno rappresenta un sistema indipendente: collaboratori, prodotti e numeri identificativi possono essere completamente diversi da un anno all'altro
- Le impostazioni di grafici e tabelle create in Statistiche restano invece disponibili come template riutilizzabile per il nuovo anno
- Gli anni passati restano completamente consultabili e modificabili

### Temi
- Tema Chiaro e tema Scuro
- Cambio tema tramite pulsante con icone sole/luna

### Icone
- Solo icone in formato SVG
- Nessuna emoji

## Punti da definire prima dello sviluppo
- Formato/struttura dei file CSV da importare (quali colonne sono attese: nome, mese, valore, categoria, ecc.) — in attesa di un file di esempio
