package migrations

import "testing"

func TestBaselineVersions(t *testing.T) {
	tests := []struct {
		name  string
		state schemaState
		want  []int64
	}{
		{
			name:  "empty schema",
			state: schemaState{},
			want:  nil,
		},
		{
			name:  "legacy production baseline",
			state: schemaState{hasCoreTables: true, hasUsersTable: true},
			want:  []int64{1, 2},
		},
		{
			name:  "already patched show flags",
			state: schemaState{hasCoreTables: true, hasUsersTable: true, hasShowFlags: true},
			want:  []int64{1, 2, 3},
		},
		{
			name:  "manual core plus show only",
			state: schemaState{hasCoreTables: true, hasShowFlags: true},
			want:  []int64{1, 3},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := baselineVersions(test.state)
			if len(got) != len(test.want) {
				t.Fatalf("unexpected length: got=%v want=%v", got, test.want)
			}
			for index := range got {
				if got[index] != test.want[index] {
					t.Fatalf("unexpected versions: got=%v want=%v", got, test.want)
				}
			}
		})
	}
}
