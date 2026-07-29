import { SectionTitle } from '../components/Card'
import FitnessBoard from '../components/FitnessBoard'
import { useFitness } from '../hooks/useFitness'

export default function FitnessView() {
  const api = useFitness()
  return (
    <div>
      <SectionTitle>💪 Fitness — abilities</SectionTitle>
      <FitnessBoard {...api} />
    </div>
  )
}
