// Your updated content that includes the changes applied to the ranking. 
// Assuming you want to include the changes to the sorting logic here.

// Updated ranking logic 
const combined = merged.sort((a, b) => {
    if (b.count !== a.count) {
        return b.count - a.count; // sort by count descending
    }
    if (a.term !== b.term) {
        return a.term.localeCompare(b.term); // sort by term ascending
    }
    return a.kind.localeCompare(b.kind); // sort by kind ascending
});

// All other code remains unchanged.