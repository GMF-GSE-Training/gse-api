# Frontend Sorting Implementation Guide

## Ringkasan Perubahan Yang Telah Dilakukan

### ❌ PERHATIAN: Perubahan dilakukan di direktori yang salah!
Perubahan yang dijelaskan di bawah ini telah dilakukan di direktori `gse-intern-docs/` namun seharusnya diimplementasikan di direktori `frontend/`. Agen AI selanjutnya perlu mengimplementasikan perubahan ini di lokasi yang benar.

### 1. Komponen Modal Participant (`ParticipantCotModalComponent`)

**File yang perlu diupdate:** `frontend/src/app/components/participant-cot-modal/participant-cot-modal.component.ts`

#### Perubahan yang diperlukan:

```typescript
export class ParticipantCotModalComponent {
  // Input properties untuk sorting state
  @Input() sortBy: string = '';
  @Input() sortOrder: 'asc' | 'desc' = 'asc';
  
  // Output event untuk memberitahu parent component tentang perubahan sorting
  @Output() sortChange = new EventEmitter<{sortBy: string, sortOrder: 'asc' | 'desc'}>();

  // Method untuk handle sorting
  onSort(field: string) {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'asc';
    }
    
    this.sortChange.emit({
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    });
  }

  // Method untuk mendapatkan CSS class untuk sorting icon
  getSortClass(field: string): string {
    if (this.sortBy !== field) return 'sort-none';
    return this.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc';
  }
}
```

#### Template HTML yang diperlukan:

**File:** `frontend/src/app/components/participant-cot-modal/participant-cot-modal.component.html`

```html
<table class="table">
  <thead>
    <tr>
      <th (click)="onSort('name')" class="sortable-header">
        Name
        <i class="fas fa-sort" [ngClass]="getSortClass('name')"></i>
      </th>
      <th (click)="onSort('email')" class="sortable-header">
        Email
        <i class="fas fa-sort" [ngClass]="getSortClass('email')"></i>
      </th>
      <th (click)="onSort('department')" class="sortable-header">
        Department
        <i class="fas fa-sort" [ngClass]="getSortClass('department')"></i>
      </th>
      <th (click)="onSort('createdAt')" class="sortable-header">
        Created Date
        <i class="fas fa-sort" [ngClass]="getSortClass('createdAt')"></i>
      </th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <!-- Participant rows here -->
  </tbody>
</table>
```

#### CSS yang diperlukan:

**File:** `frontend/src/app/components/participant-cot-modal/participant-cot-modal.component.scss`

```scss
.sortable-header {
  cursor: pointer;
  user-select: none;
  
  &:hover {
    background-color: #f8f9fa;
  }
  
  i.fas {
    margin-left: 5px;
    opacity: 0.5;
    
    &.sort-asc::before {
      content: "\f0de"; // fa-sort-up
      opacity: 1;
    }
    
    &.sort-desc::before {
      content: "\f0dd"; // fa-sort-down  
      opacity: 1;
    }
    
    &.sort-none::before {
      content: "\f0dc"; // fa-sort
    }
  }
}
```

### 2. Parent Component (`CotDetailComponent`)

**File yang perlu diupdate:** `frontend/src/app/pages/cot-detail/cot-detail.component.ts`

#### Perubahan yang diperlukan:

```typescript
export class CotDetailComponent {
  // Tambahkan state untuk sorting modal
  modalSortBy: string = '';
  modalSortOrder: 'asc' | 'desc' = 'asc';
  
  // Method untuk handle sorting change dari modal
  onModalSortChange(sortData: {sortBy: string, sortOrder: 'asc' | 'desc'}) {
    this.modalSortBy = sortData.sortBy;
    this.modalSortOrder = sortData.sortOrder;
    
    // Reload unregistered participants dengan sorting baru
    this.getUnregisteredParticipants();
  }
  
  // Update method untuk fetch unregistered participants
  getUnregisteredParticipants() {
    const params = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.modalSortBy,
      sortOrder: this.modalSortOrder
    };
    
    this.participantCotService.getUnregisteredParticipants(this.cotId, params)
      .subscribe(response => {
        this.unregisteredParticipants = response.data;
        this.totalUnregistered = response.total;
      });
  }
}
```

#### Template HTML yang diperlukan:

**File:** `frontend/src/app/pages/cot-detail/cot-detail.component.html`

```html
<app-participant-cot-modal
  [isOpen]="isModalOpen"
  [participants]="unregisteredParticipants"
  [sortBy]="modalSortBy"
  [sortOrder]="modalSortOrder"
  (sortChange)="onModalSortChange($event)"
  (close)="closeModal()"
  (addParticipant)="addParticipantToCot($event)">
</app-participant-cot-modal>
```

### 3. Service Update (Jika diperlukan)

**File:** `frontend/src/app/services/participant-cot.service.ts`

Pastikan service method mendukung parameter sorting:

```typescript
getUnregisteredParticipants(cotId: string, params: any) {
  const queryParams = new HttpParams()
    .set('page', params.page?.toString() || '1')
    .set('limit', params.limit?.toString() || '10')
    .set('sortBy', params.sortBy || '')
    .set('sortOrder', params.sortOrder || 'asc');
    
  return this.http.get<any>(`/api/cot/${cotId}/unregistered-participants`, {
    params: queryParams
  });
}
```

## Implementasi Yang Belum Selesai

### 1. Pagination Integration
- Modal perlu pagination controls yang terintegrasi dengan sorting
- State pagination perlu di-reset ketika sorting berubah

### 2. Loading States
- Tambahkan loading indicator saat data sedang di-fetch dengan sorting baru
- Disable sorting buttons saat loading

### 3. Error Handling
- Handle error ketika sorting request gagal
- Fallback ke sorting sebelumnya jika terjadi error

### 4. Search Integration
- Jika ada search functionality, perlu diintegrasikan dengan sorting
- Reset sorting ketika search query berubah

## Contoh Implementasi Pagination + Sorting

```typescript
// Di CotDetailComponent
onModalSortChange(sortData: {sortBy: string, sortOrder: 'asc' | 'desc'}) {
  this.modalSortBy = sortData.sortBy;
  this.modalSortOrder = sortData.sortOrder;
  this.currentModalPage = 1; // Reset ke page 1 ketika sorting berubah
  this.getUnregisteredParticipants();
}

onModalPageChange(page: number) {
  this.currentModalPage = page;
  this.getUnregisteredParticipants();
}
```

## Testing Checklist

- [ ] Sorting icon muncul di semua kolom yang dapat disortir
- [ ] Klik header kolom mengubah sorting direction
- [ ] Data ter-reload dengan benar sesuai sorting
- [ ] Pagination ter-reset ke page 1 saat sorting berubah
- [ ] Loading state ditampilkan saat fetching data
- [ ] Error handling bekerja dengan baik

## Backend API Yang Sudah Tersedia

Backend sudah mendukung sorting dengan parameter:
- `sortBy`: field name untuk sorting
- `sortOrder`: 'asc' atau 'desc'
- `page`: nomor halaman
- `limit`: jumlah item per halaman

Endpoint: `GET /api/participant-cot/:cotId/unregistered-participants`

## Langkah Implementasi Untuk Agen AI Selanjutnya

1. **Cek struktur direktori frontend** untuk memastikan lokasi file yang benar
2. **Implementasi perubahan di komponen modal** sesuai panduan di atas
3. **Update parent component** untuk handle sorting state
4. **Test integration** antara frontend dan backend
5. **Tambahkan pagination integration** jika belum ada
6. **Implement loading states dan error handling**

## Catatan Penting

- Semua perubahan harus dilakukan di direktori `frontend/` bukan `gse-intern-docs/`
- Backend sudah mendukung sorting, tinggal frontend yang perlu diupdate
- Pastikan CSS untuk sorting icons sudah tersedia (FontAwesome atau icon library lain)
- Test dengan data yang cukup banyak untuk memastikan sorting bekerja dengan baik
